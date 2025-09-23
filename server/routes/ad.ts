import { Router } from 'express';
import { readFileSync, writeFileSync, appendFileSync, existsSync, watchFile, unwatchFile, renameSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

// Type definitions
interface AdRequest {
  placement?: string;
  page_context?: {
    url?: string;
    title?: string;
    path?: string;
    keywords?: string[];
    topic?: string;
    results_text?: string;
  };
  user_context?: {
    anon_id?: string;
    lang?: string;
    device?: string;
    geo_country?: string;
    dnt?: boolean;
  };
  anon_id?: string;
}

interface AdData {
  id: string;
  placement: string;
  targeting_keywords: string[];
  landing_url: string;
  base_headline: string;
  base_body: string;
  floor_ecpm: number;
  blocked_paths: string[];
  lang: string;
}

interface AdStats {
  impressions: number;
  clicks: number;
  alpha: number;
  beta: number;
  updatedAt: number;
}

interface ScoredAd {
  ad: AdData;
  score: number;
  passesFloor: boolean;
  estimatedECPM?: number;
}

// Mutex for file operations
let fileMutex: Promise<void> = Promise.resolve();

// AI Agent for Ad Selection
async function selectAdWithAI(
  pageContext: AdRequest['page_context'],
  userContext: AdRequest['user_context'],
  eligibleAds: AdData[],
  priorStats: any[]
): Promise<any> {
  // Validate inputs - don't call AI agent if we have empty critical arrays
  if (!eligibleAds || eligibleAds.length === 0) {
    console.log('[AI Agent] Skipping AI agent - no eligible ads');
    return null;
  }

  if (!priorStats || priorStats.length === 0) {
    console.log('[AI Agent] Skipping AI agent - no prior stats available');
    return null;
  }

  // Clean page_context to remove any empty arrays
  const cleanPageContext = {
    ...pageContext,
    // Remove keywords if it's empty array, since we're using results_text primarily now
    ...(pageContext?.keywords && pageContext.keywords.length > 0 ? { keywords: pageContext.keywords } : {})
  };

  // Clean eligible_ads to remove all empty arrays
  const cleanEligibleAds = eligibleAds.map(ad => {
    const cleanAd: any = {};
    for (const [key, value] of Object.entries(ad)) {
      // Include all non-array values
      if (!Array.isArray(value)) {
        cleanAd[key] = value;
      }
      // Only include arrays that have items
      else if (Array.isArray(value) && value.length > 0) {
        cleanAd[key] = value;
      }
      // Skip empty arrays entirely
    }
    return cleanAd;
  });

  const aiRequest = {
    page_context: cleanPageContext,
    user_context: userContext,
    eligible_ads: cleanEligibleAds,
    prior_stats: priorStats,
    config: {
      keyword_overlap_min: 1,
      assumed_cpc_cents: 25,
      num_ads_requested: 3
    }
  };

  // Retry logic: try up to 3 times
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`[AI Agent] Attempt ${attempt}/3 - Sending request to AI agent`);
      if (attempt === 1) {
        console.log('[AI Agent] Request payload:', JSON.stringify(aiRequest, null, 2));
      }

      // Call your AI agent endpoint
      const aiResponse = await fetch('https://cmfurpcfzsyt4jxgtu6q8fmu6.agent.pa.smyth.ai/api/optimize_ads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(aiRequest),
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (!aiResponse.ok) {
        console.log(`[AI Agent] Attempt ${attempt}/3 - HTTP error:`, aiResponse.status, aiResponse.statusText);
        if (attempt === 3) return null; // Last attempt failed
        await new Promise(resolve => setTimeout(resolve, 500 * attempt)); // Brief delay before retry
        continue; // Try again
      }

      const aiResult: any = await aiResponse.json();
      console.log(`[AI Agent] Attempt ${attempt}/3 - Received response:`, JSON.stringify(aiResult));

      // Check if we got valid data
      const hasValidResponse = (
        aiResult &&
        aiResult.result &&
        aiResult.result.Output &&
        aiResult.result.Output.response &&
        aiResult.result.Output.response.chosen &&
        aiResult.result.Output.response.chosen.ad_id
      ) || (
        aiResult &&
        aiResult.chosen &&
        aiResult.chosen.ad_id
      );

      // Check for error responses
      const hasError = (
        aiResult &&
        aiResult.result &&
        aiResult.result._error
      );

      if (hasValidResponse) {
        console.log(`[AI Agent] Success on attempt ${attempt}/3 - Valid response received`);
        return aiResult; // Success - return immediately
      } else if (hasError) {
        console.log(`[AI Agent] Attempt ${attempt}/3 - AI agent returned error:`, aiResult.result._error);
        if (attempt === 3) return null; // Last attempt failed
        await new Promise(resolve => setTimeout(resolve, 500 * attempt)); // Brief delay before retry
        continue; // Try again
      } else {
        console.log(`[AI Agent] Attempt ${attempt}/3 - Invalid response format received`);
        if (attempt === 3) return null; // Last attempt failed
        await new Promise(resolve => setTimeout(resolve, 500 * attempt)); // Brief delay before retry
        continue; // Try again
      }

    } catch (error) {
      console.error(`[AI Agent] Attempt ${attempt}/3 - Error calling AI agent:`, error);
      if (attempt === 3) return null; // Last attempt failed
      await new Promise(resolve => setTimeout(resolve, 500 * attempt)); // Brief delay before retry
      continue; // Try again
    }
  }

  return null; // All attempts failed
}

// Paths to ad system files
const adsPath = join(__dirname, '../../ads');
const adsFilePath = join(adsPath, 'ads.json');
const statsFilePath = join(adsPath, 'stats.json');
const impressionsFilePath = join(adsPath, 'impressions.jsonl');
const clicksFilePath = join(adsPath, 'clicks.jsonl');
const freqcapFilePath = join(adsPath, 'freqcap.json');
const configFilePath = join(adsPath, 'config.json');

// Config cache with hot reload
let configCache: any = null;
let configWatchSet = false;

// In-memory impression map for recent lookups
const recentImpressions = new Map<string, any>();
const RECENT_IMPRESSIONS_LIMIT = 1000;

// Helper functions
function withFileMutex<T>(operation: () => Promise<T>): Promise<T> {
  const nextMutex = fileMutex.then(async (): Promise<T> => {
    try {
      return await operation();
    } catch (error) {
      console.error('File operation error:', error);
      throw error;
    }
  });
  fileMutex = nextMutex.then(() => {});
  return nextMutex;
}

function loadJSON(filePath: string, defaultValue: any = {}): any {
  try {
    if (!existsSync(filePath)) {
      writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
      return defaultValue;
    }
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (error) {
    console.warn(`Warning: Error loading ${filePath}, using defaults:`, error);
    writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
    return defaultValue;
  }
}

function atomicWriteJSON(filePath: string, data: any): void {
  const tempPath = `${filePath}.tmp`;
  writeFileSync(tempPath, JSON.stringify(data, null, 2));
  // Atomic rename
  renameSync(tempPath, filePath);
}

function appendJSONL(filePath: string, data: any): void {
  appendFileSync(filePath, JSON.stringify(data) + '\n');
}

function loadConfig(): any {
  if (!configCache) {
    configCache = loadJSON(configFilePath, {
      epsilon: 0.10,
      daily_frequency_cap: 3,
      assumed_cpc_cents: 25,
      keyword_overlap_min: 1
    });

    // Set up config file watching for hot reload
    if (!configWatchSet && process.env.NODE_ENV !== 'production') {
      configWatchSet = true;
      watchFile(configFilePath, { interval: 1000 }, () => {
        console.log('Config file changed, reloading...');
        configCache = null;
      });
    }
  }
  return configCache;
}

function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function sanitizeString(str: string): string {
  return str.replace(/[<>\"'&]/g, '').substring(0, 1000);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function extractKeywords(text: string): string[] {
  const stopwords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'will', 'would', 'could', 'should']);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopwords.has(word))
    .slice(0, 5);
}

function extractTopicAndKeywords(pageContext: any): { topic: string; keywords: string[] } {
  // Prioritize results_text if available, otherwise fallback to other content
  const primaryText = pageContext.results_text || pageContext.title || pageContext.h1 || pageContext.path || '';
  const topic = slugify(primaryText);

  // Extract keywords from results_text if available, otherwise use other sources
  const keywordSource = pageContext.results_text ||
                       (pageContext.title + ' ' + (pageContext.meta_description || '')) ||
                       pageContext.h1 ||
                       pageContext.path || '';

  const keywords = extractKeywords(keywordSource);
  return { topic, keywords };
}

function checkFrequencyCap(anonId: string, adId: string): boolean {
  const config = loadConfig();
  const freqcap = loadJSON(freqcapFilePath, {});
  const today = getTodayKey();

  const todayData = freqcap[today] || {};
  const userData = todayData[anonId] || {};
  const adCount = userData[adId] || 0;

  return adCount < config.daily_frequency_cap;
}

function updateFrequencyCap(anonId: string, adId: string): void {
  const freqcap = loadJSON(freqcapFilePath, {});
  const today = getTodayKey();

  if (!freqcap[today]) freqcap[today] = {};
  if (!freqcap[today][anonId]) freqcap[today][anonId] = {};
  if (!freqcap[today][anonId][adId]) freqcap[today][anonId][adId] = 0;

  freqcap[today][anonId][adId]++;
  atomicWriteJSON(freqcapFilePath, freqcap);
}

function getAdStats(adId: string, topic: string): { alpha: number; beta: number; impressions: number; clicks: number } {
  const stats = loadJSON(statsFilePath, { byTopic: {} });

  if (!stats.byTopic[topic]) stats.byTopic[topic] = {};
  if (!stats.byTopic[topic][adId]) {
    stats.byTopic[topic][adId] = {
      impressions: 0,
      clicks: 0,
      alpha: 1,
      beta: 20,
      updatedAt: Date.now()
    };
  }

  return stats.byTopic[topic][adId];
}

function updateAdStats(adId: string, topic: string, isClick: boolean = false): void {
  const stats = loadJSON(statsFilePath, { byTopic: {} });

  if (!stats.byTopic[topic]) stats.byTopic[topic] = {};
  if (!stats.byTopic[topic][adId]) {
    stats.byTopic[topic][adId] = {
      impressions: 0,
      clicks: 0,
      alpha: 1,
      beta: 20,
      updatedAt: Date.now()
    };
  }

  const adStats = stats.byTopic[topic][adId];

  if (isClick) {
    adStats.clicks++;
  } else {
    adStats.impressions++;
  }

  // Update Beta distribution parameters
  adStats.alpha = 1 + adStats.clicks;
  adStats.beta = 1 + adStats.impressions - adStats.clicks;
  adStats.updatedAt = Date.now();

  atomicWriteJSON(statsFilePath, stats);
}

function sampleCTR(alpha: number, beta: number): number {
  // Simple approximation of Beta distribution sampling
  // In production, you might want to use a proper beta distribution library
  return alpha / (alpha + beta) + (Math.random() - 0.5) * 0.01;
}

function calculateMatchScore(adKeywords: string[], pageKeywords: string[]): number {
  const matches = adKeywords.filter(adKw =>
    pageKeywords.some(pageKw =>
      adKw.toLowerCase().includes(pageKw.toLowerCase()) ||
      pageKw.toLowerCase().includes(adKw.toLowerCase())
    )
  ).length;
  return Math.min(5, matches);
}

// POST /ad/request - Returns multiple ads (up to 3)
router.post('/request', async (req: any, res: any) => {
  try {
    // Check DNT header
    if (req.get('DNT') === '1') {
      return res.json({ ads: [] });
    }

    const { page_context, user_context, anon_id } = req.body;

    // Generate anon_id if not provided
    let finalAnonId = anon_id;
    if (!finalAnonId) {
      finalAnonId = uuidv4();
    }

    // Extract topic and keywords
    const { topic, keywords } = extractTopicAndKeywords(page_context || {});

    // Load ads and config
    const ads = loadJSON(adsFilePath, []);
    const config = loadConfig();

    // Filter eligible ads - accept all placements for multi-ad response
    let eligibleAds = ads.filter((ad: any) => {

      // Check language
      if (ad.lang !== 'any' && user_context?.lang) {
        const adLang = ad.lang.substring(0, 2);
        const userLang = user_context.lang.substring(0, 2);
        if (adLang !== userLang) return false;
      }

      // Check blocked paths
      if (page_context?.path && ad.blocked_paths.some((blockedPath: string) =>
        page_context.path.includes(blockedPath))) return false;

      // Check keyword overlap (except for house ads)
      if (ad.floor_ecpm > 0 && ad.targeting_keywords.length > 0) {
        const overlap = calculateMatchScore(ad.targeting_keywords, keywords);
        if (overlap < config.keyword_overlap_min) return false;
      }

      // Check frequency cap
      if (!checkFrequencyCap(finalAnonId, ad.id)) return false;

      return true;
    });

    // Fallback to house ads if no eligible ads
    if (eligibleAds.length === 0) {
      eligibleAds = ads.filter((ad: any) => ad.floor_ecpm === 0);
    }

    if (eligibleAds.length === 0) {
      return res.json({ ads: [], anon_id: finalAnonId });
    }

    // AI Agent Selection Logic for Multiple Ads
    let selectedAds: any[] = [];

    // Prepare data for AI agent
    const priorStats = eligibleAds.map((ad: any) => {
      const adStats = getAdStats(ad.id, topic);
      return {
        ad_id: ad.id,
        topic: topic,
        impressions: adStats.impressions || 0,
        clicks: adStats.clicks || 0,
        alpha: adStats.alpha,
        beta: adStats.beta,
        ctr_mean: adStats.alpha / (adStats.alpha + adStats.beta)
      };
    });

    // Try AI agent selection first
    console.log('[AI] Attempting AI agent selection with', eligibleAds.length, 'eligible ads and', priorStats.length, 'prior stats');
    const aiResult = await selectAdWithAI(page_context, user_context, eligibleAds, priorStats);
    console.log('[AI] AI agent result:', aiResult);

    // Parse AI agent response - handle single or multiple ads
    let aiChosenAds = null;
    if (aiResult && aiResult.result && aiResult.result.Output && aiResult.result.Output.response && aiResult.result.Output.response.chosen) {
      // New format: result.Output.response.chosen (handle single ad response)
      const chosen = aiResult.result.Output.response.chosen;
      aiChosenAds = Array.isArray(chosen) ? chosen : [chosen];
    } else if (aiResult && aiResult.chosen) {
      // Old format: chosen (convert to array)
      aiChosenAds = Array.isArray(aiResult.chosen) ? aiResult.chosen : [aiResult.chosen];
    }

    console.log('[AI Agent] Parsed chosen ads:', aiChosenAds);

    if (aiChosenAds && aiChosenAds.length > 0) {
      // Use AI agent selections
      for (const aiChosen of aiChosenAds.slice(0, 3)) { // Limit to 3 ads
        if (aiChosen && aiChosen.ad_id) {
          const selectedAd = eligibleAds.find((ad: any) => ad.id === aiChosen.ad_id);
          if (selectedAd) {
            // Use AI-generated headline and body if provided
            const aiSelectedHeadline = aiChosen.headline || selectedAd.base_headline;
            const aiSelectedBody = aiChosen.body || selectedAd.base_body;
            selectedAds.push({
              ad: selectedAd,
              headline: aiSelectedHeadline,
              body: aiSelectedBody
            });
            console.log('[AI Agent] Selected ad:', selectedAd.id, 'with AI-generated content');
          }
        }
      }
    }

    // Fallback to Thompson sampling if AI fails or returns fewer than 3 ads
    while (selectedAds.length < 3 && selectedAds.length < eligibleAds.length) {
      console.log('[AI Agent] Need more ads, using Thompson sampling for ad', selectedAds.length + 1);

      // Filter out already selected ads
      const alreadySelected = selectedAds.map(sa => sa.ad.id);
      const remainingAds = eligibleAds.filter((ad: any) => !alreadySelected.includes(ad.id));

      if (remainingAds.length === 0) break;

      let fallbackAd: any;
      if (Math.random() < config.epsilon) {
        // Explore: random selection
        fallbackAd = remainingAds[Math.floor(Math.random() * remainingAds.length)];
      } else {
        // Exploit: score-based selection
        const scoredAds: ScoredAd[] = remainingAds.map((ad: AdData): ScoredAd => {
          const matchScore = calculateMatchScore(ad.targeting_keywords, keywords);
          const adStats = getAdStats(ad.id, topic);
          const sampledCTR = sampleCTR(adStats.alpha, adStats.beta);
          const score = matchScore * sampledCTR;

          // Floor check
          const estimatedECPM = 1000 * sampledCTR * (config.assumed_cpc_cents / 100);
          const passesFloor = estimatedECPM >= ad.floor_ecpm;

          return { ad, score, passesFloor, estimatedECPM };
        });

        // Sort by score and filter by floor
        scoredAds.sort((a: any, b: any) => b.score - a.score);
        const floorPassingAds = scoredAds.filter((item: any) => item.passesFloor);

        fallbackAd = floorPassingAds.length > 0 ? floorPassingAds[0].ad : scoredAds[0].ad;
      }

      selectedAds.push({
        ad: fallbackAd,
        headline: fallbackAd.base_headline,
        body: fallbackAd.base_body
      });
    }

    // Generate impressions for all selected ads
    const impressions = selectedAds.map(selectedAdInfo => {
      const impressionId = uuidv4();
      return {
        impression_id: impressionId,
        ad_id: selectedAdInfo.ad.id,
        topic,
        page: page_context?.path || '',
        anon_id: finalAnonId,
        ts: Date.now(),
        placement: selectedAdInfo.ad.placement || 'sidebar',
        keywords: keywords.join(',')
      };
    });

    // Log all impressions and update stats
    await withFileMutex(async () => {
      impressions.forEach(impression => {
        appendJSONL(impressionsFilePath, impression);
        updateAdStats(impression.ad_id, topic, false);
        updateFrequencyCap(finalAnonId, impression.ad_id);
      });
    });

    // Cache recent impressions for click lookup
    impressions.forEach(impression => {
      recentImpressions.set(impression.impression_id, impression);
      if (recentImpressions.size > RECENT_IMPRESSIONS_LIMIT) {
        const firstKey = recentImpressions.keys().next().value;
        if (firstKey !== undefined) {
          recentImpressions.delete(firstKey);
        }
      }
    });

    // Build response with multiple ads
    const adsResponse = selectedAds.map((selectedAdInfo, index) => {
      const html = `<a href="${selectedAdInfo.ad.landing_url}" rel="nofollow sponsored" target="_blank">${selectedAdInfo.headline}</a>`;

      return {
        impression_id: impressions[index].impression_id,
        ad_id: selectedAdInfo.ad.id,
        headline: selectedAdInfo.headline,
        body: selectedAdInfo.body,
        landing_url: selectedAdInfo.ad.landing_url,
        placement: selectedAdInfo.ad.placement || 'sidebar',
        html
      };
    });

    res.json({
      ads: adsResponse,
      anon_id: finalAnonId
    });

  } catch (error) {
    console.error('Error in /ad/request:', error);
    res.status(500).json({ error: 'Failed to serve ad' });
  }
});

// POST /ad/click
router.post('/click', async (req, res) => {
  try {
    const { impression_id } = req.body;

    if (!impression_id) {
      return res.status(400).json({ error: 'impression_id is required' });
    }

    // Look up impression
    let impression = recentImpressions.get(impression_id);

    if (!impression) {
      // Fallback: scan impressions.jsonl (this could be optimized with a proper index)
      const fileStream = createReadStream(impressionsFilePath);
      const rl = createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      for await (const line of rl) {
        if (line.trim()) {
          const imp = JSON.parse(line);
          if (imp.impression_id === impression_id) {
            impression = imp;
            break;
          }
        }
      }
    }

    if (!impression) {
      return res.status(404).json({ error: 'Impression not found' });
    }

    // Record click
    const click = {
      impression_id,
      ad_id: impression.ad_id,
      topic: impression.topic,
      ts: Date.now()
    };

    await withFileMutex(async () => {
      appendJSONL(clicksFilePath, click);
      updateAdStats(impression.ad_id, impression.topic, true);
    });

    res.json({ ok: true });

  } catch (error) {
    console.error('Error in /ad/click:', error);
    res.status(500).json({ error: 'Failed to record click' });
  }
});

// GET /ad/health
router.get('/health', (req, res) => {
  res.json({ ok: true });
});

// GET /ad/dev/debug (development only)
router.get('/dev/debug', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const impressions: any[] = [];
    const clicks: any[] = [];

    // Read last N impressions
    if (existsSync(impressionsFilePath)) {
      const fileStream = createReadStream(impressionsFilePath);
      const rl = createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      const allImpressions: any[] = [];
      for await (const line of rl) {
        if (line.trim()) {
          allImpressions.push(JSON.parse(line));
        }
      }
      impressions.push(...allImpressions.slice(-limit));
    }

    // Read last N clicks
    if (existsSync(clicksFilePath)) {
      const fileStream = createReadStream(clicksFilePath);
      const rl = createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      const allClicks: any[] = [];
      for await (const line of rl) {
        if (line.trim()) {
          allClicks.push(JSON.parse(line));
        }
      }
      clicks.push(...allClicks.slice(-limit));
    }

    res.json({
      impressions,
      clicks,
      stats: loadJSON(statsFilePath, { byTopic: {} }),
      config: loadConfig(),
      recent_impressions_cache_size: recentImpressions.size
    });

  } catch (error) {
    console.error('Error in /ad/dev/debug:', error);
    res.status(500).json({ error: 'Failed to get debug info' });
  }
});

// Cleanup on process exit
process.on('exit', () => {
  if (configWatchSet) {
    unwatchFile(configFilePath);
  }
});

export default router;