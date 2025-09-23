import { Router } from 'express';
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

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

function generateAnonId(req: any): string {
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

// GET /api/ads - Serve ads based on context
router.get('/', (req, res) => {
  try {
    const { placement = 'sidebar', topic = 'general', path = '', keywords = '' } = req.query;

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
      if (ad.targeting_keywords.length > 0 && keywords) {
        const searchKeywords = keywords.toString().toLowerCase().split(',').map((k: string) => k.trim());
        const overlap = ad.targeting_keywords.filter((targetKeyword: string) =>
          searchKeywords.some(sk => sk.includes(targetKeyword.toLowerCase()) ||
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

    // Select ad using epsilon-greedy + Thompson sampling
    const selectedAd = selectAd(eligibleAds, topic.toString(), config.epsilon);

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
        impression_id: impressionId
      },
      context: {
        placement,
        topic,
        eligible_count: eligibleAds.length
      }
    });

  } catch (error) {
    console.error('Error serving ads:', error);
    res.status(500).json({ error: 'Failed to serve ads' });
  }
});

// POST /api/ads/click - Record ad click
router.post('/click', (req, res) => {
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
router.get('/stats', (req, res) => {
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
router.get('/config', (req, res) => {
  try {
    const config = loadJSON(configFilePath, {});
    res.json(config);
  } catch (error) {
    console.error('Error fetching config:', error);
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

export default router;