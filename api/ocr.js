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
5. For each word pair, write one example sentence in Spanish (example_sentence).

Rules for extraction:
- Only include pairs actually visible in the image — do not invent new translations or add extra meanings.
- If a pair is domain-specific or unusual but plausible, keep it as-is.

Rules for example sentences (follow all of these — they are strict):
- SELF-CHECK REQUIRED: Before returning, verify that each sentence actually contains the source_word (or a directly recognisable conjugated/declined form). If you cannot embed the word naturally, write "—" for that field. NEVER substitute a different word.
- For multi-word expressions or idioms, the entire phrase must appear in the sentence, not just one word of it.
- The sentence must provide enough surrounding context that a reader could infer the word's rough meaning without knowing it — avoid one-clause sentences with no narrative.
- Register: EU / political / geopolitical / economic Spanish (e.g. European Parliament debates, diplomacy, trade, governance). This matches the vocabulary domain.
- Preferred length: 20–35 words.
- Avoid first-person constructions (e.g. "solicito") when source_word is an infinitive — prefer third-person or impersonal constructions.
- The word's usage in the sentence must be semantically consistent with the German translation given.

Return ONLY a valid JSON array:
[{"source_word": "Spanish word or phrase", "target_word": "German translation(s)", "example_sentence": "..."}]
If no pairs found, return [].
No explanation, no markdown, just the JSON array.`,
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
