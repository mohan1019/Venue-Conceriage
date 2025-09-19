import { Router } from 'express';

const router = Router();

router.post('/relay', async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    const maxTokens = parseInt(process.env.AI_MAX_TOKENS_PER_CALL || '1200');

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Log request size for monitoring
    const requestSize = JSON.stringify(req.body).length;
    console.log(`Agent relay request size: ${requestSize} bytes`);

    // Check if SmythOS is configured
    const smythosUrl = process.env.SMYTHOS_AGENT_URL;
    const smythosApiKey = process.env.SMYTHOS_API_KEY;

    if (!smythosUrl || !smythosApiKey) {
      // Return mock response for demo purposes
      const mockResponse = {
        reply: `I understand you're looking for venue information. Based on your message: "${message}", I can help you find the perfect venue. Would you like me to search for venues in a specific city or with particular amenities?`,
        toolResults: {
          venues: [],
          quote: null
        },
        tokensUsed: 45
      };

      return res.json(mockResponse);
    }

    // Prepare payload for SmythOS (trim large fields)
    const payload = {
      sessionId: sessionId || `session_${Date.now()}`,
      message: message.slice(0, maxTokens), // Trim message if too long
      maxTokens
    };

    // Forward to SmythOS
    const response = await fetch(smythosUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${smythosApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`SmythOS API error: ${response.status} ${response.statusText}`);
    }

    const smythosResponse = await response.json();
    const responseSize = JSON.stringify(smythosResponse).length;
    console.log(`Agent relay response size: ${responseSize} bytes`);

    // Include token usage header if available
    const tokensUsed = response.headers.get('x-token-used');
    if (tokensUsed) {
      res.setHeader('x-token-used', tokensUsed);
    }

    res.json(smythosResponse);

  } catch (error) {
    console.error('Agent relay error:', error);
    
    // Return helpful error response
    res.status(500).json({
      error: 'AI assistant temporarily unavailable',
      reply: 'I apologize, but I\'m having trouble connecting to my AI services right now. Please try asking your question again in a moment, or feel free to browse venues directly.',
      toolResults: {}
    });
  }
});

export default router;