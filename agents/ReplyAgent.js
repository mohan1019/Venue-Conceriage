import 'dotenv/config';

export default class ReplyAgent {
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
          temperature: 0.7,
          max_tokens: 200
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

  async generateFriendlyResponse(userText) {
    try {
      const prompt = `The user provided this confusing venue request: ${userText}

Write a friendly 1–2 sentence reply that warmly acknowledges the request and concisely restates the venue details you understood (location/city, capacity/headcount, dates/timing, venue type, budget, amenities). If any detail is missing or unclear, state only what you do know—do not ask follow-up questions. Be conversational and helpful. Always end with a positive handoff indicating you're showing results (e.g., "Here are some great options." / "Here are the best matches." / "Take a look at these picks."). No bullets, no questions.

Output style: single paragraph, max 2 sentences.

Example 1: "Nice! You're looking for a Seattle venue for about 150 guests with parking and AV. Here are some great options."

Example 2: "No worries, I found venues in Seattle for about 150 guests that include parking and AV. Take a look."

Return ONLY the response text, no quotes or explanations.`;

      const result = await this.prompt(prompt);
      return result.trim();
    } catch (error) {
      console.error('Error generating friendly response:', error);
      return 'I understand you\'re looking for a venue. Here are some great options.';
    }
  }

  async processTextRequest(userText) {
    try {
      const friendlyResponse = await this.generateFriendlyResponse(userText);

      return {
        original_request: userText,
        friendly_response: friendlyResponse,
        status: 'success',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error processing text request:', error);
      return {
        error: 'Failed to process text request',
        original_request: userText
      };
    }
  }
}