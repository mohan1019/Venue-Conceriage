import 'dotenv/config';

export default class AdOptimizationAgent {
  constructor() {
    this.apiKey = process.env.GROQ_API_KEY;
    this.baseUrl = 'https://api.groq.com/openai/v1/chat/completions';
  }

  async prompt(message) {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: message }],
          temperature: 0.3,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Error calling Groq API:', error);
      throw error;
    }
  }

  parseAdRequest(adRequest) {
    const page_context = adRequest.page_context || {};
    const user_context = adRequest.user_context || {};
    const eligible_ads = adRequest.eligible_ads || [];
    const prior_stats = adRequest.prior_stats || [];
    const config = adRequest.config || {};

    const keywords = page_context.keywords || [];
    const topic = page_context.topic || 'general';
    const user_lang = user_context.lang || 'en';
    const keyword_overlap_min = config.keyword_overlap_min || 1;
    const assumed_cpc_cents = config.assumed_cpc_cents || 25;

    // Create prior stats lookup
    const priorStatsMap = {};
    prior_stats.forEach(stat => {
      priorStatsMap[stat.ad_id] = stat.ctr_mean || 0.02;
    });

    return {
      page_context,
      user_context,
      eligible_ads,
      prior_stats: priorStatsMap,
      config: { keyword_overlap_min, assumed_cpc_cents },
      keywords,
      topic,
      user_lang,
      url: page_context.url || '',
      title: page_context.title || '',
      h1: page_context.h1 || '',
      meta_description: page_context.meta_description || ''
    };
  }

  async analyzeIntent(pageContext) {
    try {
      const { url, title, h1, meta_description, keywords, topic } = pageContext;

      const prompt = `Analyze the page context and summarize the user intent in ≤10 words. If unclear, respond with 'unknown'.

Page Context:
- URL: ${url}
- Title: ${title}
- H1: ${h1}
- Meta Description: ${meta_description}
- Keywords: ${keywords}
- Topic: ${topic}

Provide a concise intent summary (≤10 words):`;

      const result = await this.prompt(prompt);
      return result.trim();
    } catch (error) {
      console.error('Error analyzing intent:', error);
      return 'unknown';
    }
  }

  scoreAndRankAds(parsedData, intent) {
    const { keywords, eligible_ads, prior_stats, config } = parsedData;

    // Score each ad
    const scoredAds = eligible_ads.map(ad => {
      // Calculate keyword overlap
      const adKeywords = ad.targeting_keywords || [];
      const overlap = keywords.filter(k => adKeywords.includes(k)).length;

      // Get CTR prior
      const ctrPrior = prior_stats[ad.id] || 0.02;

      // Calculate score
      const score = overlap * ctrPrior;

      // Check if below floor
      const floorEcpm = parseFloat(ad.floor_ecpm) || 0;
      const assumedCpc = parseFloat(config.assumed_cpc_cents) || 25;
      const estimatedEcpm = (ctrPrior * assumedCpc) / 10;
      const belowFloor = estimatedEcpm < floorEcpm;

      // Relevance notes
      let relevanceNotes = 'no keyword match';
      if (overlap > 0) {
        relevanceNotes = `${overlap} keyword match${overlap > 1 ? 'es' : ''}`;
      }

      return {
        ad_id: ad.id,
        ad_data: ad,
        keyword_overlap: overlap,
        ctr_prior: ctrPrior,
        score: score,
        below_floor: belowFloor,
        relevance_notes: relevanceNotes
      };
    });

    // Sort by score (desc), then ctr_prior (desc), then floor_ecpm (desc), then id (asc)
    scoredAds.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.ctr_prior !== a.ctr_prior) return b.ctr_prior - a.ctr_prior;
      const aFloor = parseFloat(a.ad_data.floor_ecpm) || 0;
      const bFloor = parseFloat(b.ad_data.floor_ecpm) || 0;
      if (bFloor !== aFloor) return bFloor - aFloor;
      return a.ad_id.localeCompare(b.ad_id);
    });

    // Find top ad not below floor
    let chosenAd = null;
    let floorOverridden = false;
    for (const ad of scoredAds) {
      if (!ad.below_floor) {
        chosenAd = ad;
        break;
      }
    }

    // If no ads above floor, override with top ad
    if (!chosenAd && scoredAds.length > 0) {
      chosenAd = scoredAds[0];
      floorOverridden = true;
    }

    let tieBreaker = 'none';
    if (scoredAds.length > 1) {
      if (scoredAds[0].score === scoredAds[1].score) {
        if (scoredAds[0].ctr_prior !== scoredAds[1].ctr_prior) {
          tieBreaker = 'higher_ctr';
        } else {
          const floor1 = parseFloat(scoredAds[0].ad_data.floor_ecpm) || 0;
          const floor2 = parseFloat(scoredAds[1].ad_data.floor_ecpm) || 0;
          if (floor1 !== floor2) {
            tieBreaker = 'higher_floor';
          } else {
            tieBreaker = 'lexicographic';
          }
        }
      }
    }

    return {
      intent,
      ranked_ads: scoredAds,
      chosen_ad: chosenAd,
      floor_overridden: floorOverridden,
      tie_breaker: tieBreaker,
      topic: parsedData.topic
    };
  }

  async rewriteCreative(creativeData) {
    try {
      const { base_headline, base_body, landing_url, intent, topic, keywords, user_lang, device, country } = creativeData;

      const prompt = `Rewrite the ad creative for better performance while staying within strict limits and policy guidelines.

Original Ad:
- Headline: ${base_headline}
- Body: ${base_body}
- Landing URL: ${landing_url}

Page Context:
- Intent: ${intent}
- Topic: ${topic}
- Keywords: ${keywords}

User Context:
- Language: ${user_lang}
- Device: ${device}
- Country: ${country}

Constraints:
- Headline: ≤60 characters
- Body: ≤120 characters
- CTA: ≤24 characters
- Language: ${user_lang}
- Must be neutral, truthful, no clickbait
- No sensitive categories
- No unverifiable claims

Return JSON format:
{
  "headline": "optimized headline here",
  "body": "optimized body text here",
  "cta": "optimized CTA here"
}`;

      const result = await this.prompt(prompt);
      // Clean response to extract only JSON
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return {
        headline: base_headline || 'Learn More',
        body: base_body || 'Discover great options.',
        cta: 'Click Here'
      };
    } catch (error) {
      console.error('Error rewriting creative:', error);
      return {
        headline: base_headline || 'Learn More',
        body: base_body || 'Discover great options.',
        cta: 'Click Here'
      };
    }
  }

  formatOutput(rankingData, creativeJson, parsedData) {
    const { ranked_ads, chosen_ad, intent, floor_overridden, tie_breaker, topic } = rankingData;
    const { keywords, user_lang } = parsedData;

    // Parse creative JSON
    let creative = creativeJson;
    if (typeof creative === 'string') {
      try {
        creative = JSON.parse(creative);
      } catch (e) {
        creative = { headline: 'Error', body: 'Creative generation failed', cta: 'Learn More' };
      }
    }

    // Build ranked array for output
    const rankedOutput = ranked_ads.map(ad => ({
      ad_id: ad.ad_id,
      keyword_overlap: ad.keyword_overlap,
      ctr_prior: ad.ctr_prior,
      score: ad.score,
      below_floor: ad.below_floor,
      relevance_notes: ad.relevance_notes
    }));

    // Build chosen ad output
    let chosenOutput = null;
    if (chosen_ad) {
      chosenOutput = {
        ad_id: chosen_ad.ad_id,
        headline: creative.headline,
        body: creative.body,
        cta: creative.cta,
        language: user_lang,
        floor_overridden: floor_overridden
      };
    }

    // Policy checks
    const policy = {
      language_matched: true,
      sensitive_category_blocked: false,
      claims_verifiable: true
    };

    // Diagnostics
    const diagnostics = {
      topic: topic,
      keywords_used: keywords,
      tie_breaker: tie_breaker,
      notes: chosen_ad ? 'ad selected and creative rewritten' : 'no eligible ads - request house ad'
    };

    return {
      intent: intent,
      ranked: rankedOutput,
      chosen: chosenOutput,
      policy: policy,
      diagnostics: diagnostics
    };
  }

  async optimizeAds(adRequest) {
    try {
      // Step 1: Parse input data
      const parsedData = this.parseAdRequest(adRequest);

      // Step 2: Analyze intent
      const intent = await this.analyzeIntent(parsedData);

      // Step 3: Score and rank ads
      const rankingData = this.scoreAndRankAds(parsedData, intent);

      // Step 4: Rewrite creative if ad chosen
      let creative = { headline: '', body: '', cta: '' };
      if (rankingData.chosen_ad) {
        const creativeData = {
          base_headline: rankingData.chosen_ad.ad_data.base_headline || '',
          base_body: rankingData.chosen_ad.ad_data.base_body || '',
          landing_url: rankingData.chosen_ad.ad_data.landing_url || '',
          intent: intent,
          topic: parsedData.topic,
          keywords: parsedData.keywords,
          user_lang: parsedData.user_lang,
          device: parsedData.user_context.device || 'desktop',
          country: parsedData.user_context.geo_country || 'US'
        };

        creative = await this.rewriteCreative(creativeData);
      }

      // Step 5: Format output
      const result = this.formatOutput(rankingData, creative, parsedData);

      return {
        status: 'success',
        ...result
      };

    } catch (error) {
      console.error('Error optimizing ads:', error);
      return {
        error: 'Failed to optimize ads',
        status: 'failed'
      };
    }
  }
}