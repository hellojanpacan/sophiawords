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
      model: 'claude-sonnet-4-6',
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
            text: `You are processing an image from a Spanish-German vocabulary learning app.

Your tasks:
1. Extract all Spanish-German word pairs visible in the image.
2. Fix OCR typos: restore correct Spanish spelling (accents: é, á, í, ó, ú, ñ, ü) and correct German spelling (umlauts: ä, ö, ü, ß, capitalised nouns).
3. Verify semantic coherence: each Spanish word must genuinely translate to its paired German word(s). If pairs appear mismatched based on meaning, re-pair them correctly.
4. If multiple German translations exist for one Spanish word, combine them as a single comma-separated entry in one object.

Rules:
- Only include pairs actually visible in the image — do not invent new translations or add extra meanings.
- If a pair is domain-specific or unusual but plausible, keep it as-is.
- Return ONLY a valid JSON array: [{"source_word": "Spanish word or phrase", "target_word": "German translation(s)"}]
- If no pairs found, return [].
- No explanation, no markdown, just the JSON array.`,
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
