import { Router } from 'express';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

// Load ads data
const adsData = JSON.parse(
  readFileSync(join(__dirname, '../../data/ads.json'), 'utf-8')
);

router.get('/', (req, res) => {
  try {
    const { context, tags, minCapacity } = req.query;
    
    let relevantAds = [...adsData];
    const contextTags: string[] = [];

    // Build context tags based on rules
    if (tags) {
      const userTags = tags.toString().toLowerCase().split(',').map(t => t.trim());
      contextTags.push(...userTags);
    }

    // Apply context-based rules
    if (context === 'search' || context === 'detail') {
      // Wedding or large capacity events get catering and decor
      if (contextTags.includes('wedding') || (minCapacity && parseInt(minCapacity.toString()) >= 150)) {
        contextTags.push('catering', 'decor');
      }

      // Projector or AV needs include AV ads
      if (contextTags.includes('projector') || contextTags.includes('av')) {
        contextTags.push('AV');
      }

      // Outdoor events get tent and lighting
      if (contextTags.includes('outdoor') || contextTags.includes('outdoor patio')) {
        contextTags.push('tent', 'lighting');
      }
    }

    // Filter ads based on context and tags
    if (contextTags.length > 0) {
      relevantAds = adsData.filter((ad: any) => {
        return contextTags.some(tag => 
          ad.targetTags.some((adTag: string) => 
            adTag.toLowerCase().includes(tag.toLowerCase()) ||
            tag.toLowerCase().includes(adTag.toLowerCase())
          ) ||
          ad.kind.toLowerCase() === tag.toLowerCase()
        );
      });
    }

    // Limit results based on context
    let maxAds = 4;
    if (context === 'search') maxAds = 4;
    if (context === 'detail') maxAds = 3;
    if (context === 'checkout') maxAds = 2;

    const selectedAds = relevantAds
      .sort(() => Math.random() - 0.5) // Shuffle for variety
      .slice(0, maxAds);

    res.json({
      ads: selectedAds,
      context,
      appliedTags: contextTags
    });
  } catch (error) {
    console.error('Error fetching ads:', error);
    res.status(500).json({ error: 'Failed to fetch ads' });
  }
});

export default router;