import { Router, Request, Response } from 'express';
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

// Paths to ad system files
const adsPath = join(__dirname, '../../ads');
const adsFilePath = join(adsPath, 'ads.json');
const statsFilePath = join(adsPath, 'stats.json');
const impressionsFilePath = join(adsPath, 'impressions.jsonl');
const clicksFilePath = join(adsPath, 'clicks.jsonl');
const freqcapFilePath = join(adsPath, 'freqcap.json');
const configFilePath = join(adsPath, 'config.json');

// Helper functions
function loadJSON(filePath: string, defaultValue: any = {}) {
  try {
    if (!existsSync(filePath)) {
      writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
      return defaultValue;
    }
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (error) {
    console.error(`Error loading ${filePath}:`, error);
    return defaultValue;
  }
}

function saveJSON(filePath: string, data: any) {
  try {
    writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Error saving ${filePath}:`, error);
  }
}

function appendJSONL(filePath: string, data: any) {
  try {
    appendFileSync(filePath, JSON.stringify(data) + '\n');
  } catch (error) {
    console.error(`Error appending to ${filePath}:`, error);
  }
}

function getTodayKey() {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

function generateAnonId(req: Request): string {
  // Simple anonymous ID based on IP + User-Agent
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';
  return Buffer.from(`${ip}-${userAgent}`).toString('base64').slice(0, 16);
}

function checkFrequencyCap(anonId: string, adId: string): boolean {
  const config = loadJSON(configFilePath, { daily_frequency_cap: 3 });
  const freqcap = loadJSON(freqcapFilePath, {});
  const today = getTodayKey();

  const todayData = freqcap[today] || {};
  const userData = todayData[anonId] || {};
  const adCount = userData[adId] || 0;

  return adCount < config.daily_frequency_cap;
}

function updateFrequencyCap(anonId: string, adId: string) {
  const freqcap = loadJSON(freqcapFilePath, {});
  const today = getTodayKey();

  if (!freqcap[today]) freqcap[today] = {};
  if (!freqcap[today][anonId]) freqcap[today][anonId] = {};
  if (!freqcap[today][anonId][adId]) freqcap[today][anonId][adId] = 0;

  freqcap[today][anonId][adId]++;
  saveJSON(freqcapFilePath, freqcap);
}

function getOrCreateStats(topic: string, adId: string) {
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

  return stats;
}

function calculateCTR(alpha: number, beta: number): number {
  // Beta distribution expected value
  return alpha / (alpha + beta);
}

// AI Agent for Ad Selection using SmythOS
async function selectAdWithAI(
  pageContext: any,
  userContext: any,
  eligibleAds: any[],
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

  // Wrap request in ad_request object as expected by SmythOS agent
  const aiRequest = {
    ad_request: {
      page_context: cleanPageContext,
      user_context: userContext,
      eligible_ads: cleanEligibleAds,
      prior_stats: priorStats,
      config: {
        keyword_overlap_min: 1,
        assumed_cpc_cents: 25,
        num_ads_requested: 1
      }
    }
  };

  // Retry logic: try up to 3 times
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`[AI Agent] Attempt ${attempt}/3 - Sending request to AI agent`);
      if (attempt === 1) {
        console.log('[AI Agent] Request payload:', JSON.stringify(aiRequest, null, 2));
      }

      // Call SmythOS AI agent endpoint
      const aiResponse = await fetch('https://cmfvy00gpxdpqo3wtm3zjmdtq.agent.pa.smyth.ai/api/optimize_ads', {
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

function selectAd(eligibleAds: any[], topic: string, epsilon: number): any {
  if (eligibleAds.length === 0) return null;

  const stats = getOrCreateStats(topic, '');

  // Epsilon-greedy selection with Thompson sampling
  if (Math.random() < epsilon) {
    // Explore: random selection
    return eligibleAds[Math.floor(Math.random() * eligibleAds.length)];
  } else {
    // Exploit: Thompson sampling
    const adsWithSamples = eligibleAds.map(ad => {
      const adStats = stats.byTopic[topic]?.[ad.id] || { alpha: 1, beta: 20 };
      // Simple beta distribution approximation
      const ctr = calculateCTR(adStats.alpha, adStats.beta);
      const sample = ctr + (Math.random() - 0.5) * 0.1; // Add noise
      return { ad, sample };
    });

    // Select ad with highest sample
    adsWithSamples.sort((a, b) => b.sample - a.sample);
    return adsWithSamples[0].ad;
  }
}

// GET /api/ads - Serve ads based on context with SmythOS optimization
router.get('/', async (req: Request, res: Response) => {
  try {
    const { placement = 'sidebar', topic = 'general', path = '', keywords = '', context = '', tags = '' } = req.query;

    // Load configuration
    const config = loadJSON(configFilePath, {
      epsilon: 0.10,
      daily_frequency_cap: 3,
      assumed_cpc_cents: 25,
      keyword_overlap_min: 1
    });

    // Load ads
    const ads = loadJSON(adsFilePath, []);
    const anonId = generateAnonId(req);

    // Extract keywords from tags parameter if provided (from URL like ?tags=venues%20in%20newyork)
    const extractedKeywords = tags ?
      tags.toString().toLowerCase().split(/[%20\+\s,]+/).filter(k => k.trim().length > 0) :
      (keywords ? keywords.toString().toLowerCase().split(',').map((k: string) => k.trim()) : []);

    // Filter eligible ads
    let eligibleAds = ads.filter((ad: any) => {
      // Check placement
      if (ad.placement !== placement) return false;

      // Check blocked paths
      if (ad.blocked_paths.some((blockedPath: string) =>
        path.toString().includes(blockedPath))) return false;

      // Check frequency cap
      if (!checkFrequencyCap(anonId, ad.id)) return false;

      // Check keyword targeting
      if (ad.targeting_keywords.length > 0 && extractedKeywords.length > 0) {
        const overlap = ad.targeting_keywords.filter((targetKeyword: string) =>
          extractedKeywords.some(sk => sk.includes(targetKeyword.toLowerCase()) ||
                                   targetKeyword.toLowerCase().includes(sk))
        ).length;

        if (overlap < config.keyword_overlap_min) return false;
      }

      return true;
    });

    // If no eligible ads, include house ads
    if (eligibleAds.length === 0) {
      eligibleAds = ads.filter((ad: any) => ad.floor_ecpm === 0);
    }

    if (eligibleAds.length === 0) {
      return res.json({ ad: null, message: 'No ads available' });
    }

    // Prepare data for SmythOS AI agent
    const pageContext = {
      url: req.get('referer') || '',
      title: context.toString() || '',
      path: path.toString(),
      keywords: extractedKeywords,
      topic: topic.toString(),
      results_text: `${context} ${tags}`.trim()
    };

    const userContext = {
      anon_id: anonId,
      lang: req.get('Accept-Language')?.split(',')[0] || 'en',
      device: req.get('User-Agent')?.includes('Mobile') ? 'mobile' : 'desktop'
    };

    const priorStats = eligibleAds.map((ad: any) => {
      const adStats = getOrCreateStats(topic.toString(), ad.id);
      const stats = adStats.byTopic[topic.toString()][ad.id];
      return {
        ad_id: ad.id,
        topic: topic.toString(),
        impressions: stats.impressions || 0,
        clicks: stats.clicks || 0,
        alpha: stats.alpha,
        beta: stats.beta,
        ctr_mean: stats.alpha / (stats.alpha + stats.beta)
      };
    });

    // Try SmythOS AI optimization first
    console.log('[AI] Attempting SmythOS optimization for', eligibleAds.length, 'ads');
    const aiResult = await selectAdWithAI(pageContext, userContext, eligibleAds, priorStats);

    let selectedAd = null;
    let aiOptimizedHeadline = null;
    let aiOptimizedBody = null;

    // Parse AI agent response
    if (aiResult && aiResult.result && aiResult.result.Output && aiResult.result.Output.response && aiResult.result.Output.response.chosen) {
      const chosen = aiResult.result.Output.response.chosen;
      selectedAd = eligibleAds.find((ad: any) => ad.id === chosen.ad_id);
      aiOptimizedHeadline = chosen.headline;
      aiOptimizedBody = chosen.body;
      console.log('[AI] SmythOS optimization successful, selected ad:', chosen.ad_id);
    } else if (aiResult && aiResult.chosen) {
      selectedAd = eligibleAds.find((ad: any) => ad.id === aiResult.chosen.ad_id);
      aiOptimizedHeadline = aiResult.chosen.headline;
      aiOptimizedBody = aiResult.chosen.body;
      console.log('[AI] SmythOS optimization successful, selected ad:', aiResult.chosen.ad_id);
    }

    // Fallback to local Thompson sampling if AI optimization fails
    if (!selectedAd) {
      console.log('[AI] SmythOS optimization failed, falling back to Thompson sampling');
      selectedAd = selectAd(eligibleAds, topic.toString(), config.epsilon);
    }

    if (!selectedAd) {
      return res.json({ ad: null, message: 'No ads available' });
    }

    // Record impression
    const impressionId = uuidv4();
    const impression = {
      impression_id: impressionId,
      ad_id: selectedAd.id,
      topic: topic.toString(),
      page: path.toString(),
      anon_id: anonId,
      ts: Date.now()
    };

    appendJSONL(impressionsFilePath, impression);
    updateFrequencyCap(anonId, selectedAd.id);

    // Update stats
    const stats = getOrCreateStats(topic.toString(), selectedAd.id);
    stats.byTopic[topic.toString()][selectedAd.id].impressions++;
    stats.byTopic[topic.toString()][selectedAd.id].updatedAt = Date.now();
    saveJSON(statsFilePath, stats);

    // Return ad with impression ID for click tracking
    res.json({
      ad: {
        ...selectedAd,
        // Use AI-optimized content if available, otherwise use original
        base_headline: aiOptimizedHeadline || selectedAd.base_headline,
        base_body: aiOptimizedBody || selectedAd.base_body,
        impression_id: impressionId
      },
      context: {
        placement,
        topic,
        eligible_count: eligibleAds.length,
        ai_optimized: !!(aiOptimizedHeadline || aiOptimizedBody)
      }
    });

  } catch (error) {
    console.error('Error serving ads:', error);
    res.status(500).json({ error: 'Failed to serve ads' });
  }
});

// POST /api/ads/click - Record ad click
router.post('/click', (req: Request, res: Response) => {
  try {
    const { impression_id, ad_id } = req.body;

    if (!impression_id || !ad_id) {
      return res.status(400).json({ error: 'impression_id and ad_id are required' });
    }

    // Record click
    const click = {
      impression_id,
      ad_id,
      ts: Date.now()
    };

    appendJSONL(clicksFilePath, click);

    // Update stats - find the topic from impressions
    // For simplicity, we'll update all topics for this ad_id
    const stats = loadJSON(statsFilePath, { byTopic: {} });

    Object.keys(stats.byTopic).forEach(topic => {
      if (stats.byTopic[topic][ad_id]) {
        stats.byTopic[topic][ad_id].clicks++;
        stats.byTopic[topic][ad_id].alpha++; // Successful conversion
        stats.byTopic[topic][ad_id].updatedAt = Date.now();
      }
    });

    saveJSON(statsFilePath, stats);

    res.json({ success: true, message: 'Click recorded' });

  } catch (error) {
    console.error('Error recording click:', error);
    res.status(500).json({ error: 'Failed to record click' });
  }
});

// GET /api/ads/stats - Get ad performance stats
router.get('/stats', (req: Request, res: Response) => {
  try {
    const { ad_id, topic } = req.query;
    const stats = loadJSON(statsFilePath, { byTopic: {} });

    if (ad_id && topic) {
      // Specific ad and topic stats
      const adStats = stats.byTopic[topic.toString()]?.[ad_id.toString()];
      if (!adStats) {
        return res.json({ error: 'Stats not found' });
      }

      const ctr = adStats.impressions > 0 ? adStats.clicks / adStats.impressions : 0;
      res.json({
        ad_id,
        topic,
        ...adStats,
        ctr
      });
    } else {
      // All stats
      const summary: any = {};
      Object.keys(stats.byTopic).forEach(topicKey => {
        summary[topicKey] = {};
        Object.keys(stats.byTopic[topicKey]).forEach(adId => {
          const adStats = stats.byTopic[topicKey][adId];
          const ctr = adStats.impressions > 0 ? adStats.clicks / adStats.impressions : 0;
          summary[topicKey][adId] = { ...adStats, ctr };
        });
      });

      res.json(summary);
    }

  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/ads/config - Get current configuration
router.get('/config', (req: Request, res: Response) => {
  try {
    const config = loadJSON(configFilePath, {});
    res.json(config);
  } catch (error) {
    console.error('Error fetching config:', error);
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

export default router;