import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image } = req.body;
  if (!image?.data || !image?.mediaType) {
    return res.status(400).json({ error: 'Invalid image data' });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: image.mediaType,
              data: image.data,
            },
          },
          {
            type: 'text',
            text: 'This image contains Spanish-German word pairs for language learning. Extract all word pairs you can find. Return ONLY a valid JSON array like: [{"source_word": "Spanish word or phrase", "target_word": "German translation"}]. If no pairs found, return []. No explanation, no markdown, just the JSON array.',
          },
        ],
      }],
    });

    const text = response.content[0].text.trim();
    // Strip markdown code fences if present
    const clean = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    const pairs = JSON.parse(clean);
    res.json({ pairs });
  } catch (e) {
    res.status(500).json({ error: e.message, pairs: [] });
  }
}
