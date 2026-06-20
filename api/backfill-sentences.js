import Anthropic from '@anthropic-ai/sdk';

const GAS_URL = 'https://script.google.com/macros/s/AKfycbwOnch7in0KD4ktQVGZW-XLhyw2Va8DT2sgqhghpRlxrKkruUDYcrhQlYo9kcAnmNI-/exec';

const SENTENCE_RULES = `Rules for example sentences (all are strict):
- SELF-CHECK REQUIRED: verify the sentence contains the source_word or a directly recognisable inflected form. If you cannot embed it naturally, write "—". NEVER substitute a different word.
- For multi-word expressions or idioms, the entire phrase must appear.
- Provide enough context for a reader to infer the meaning — avoid bare one-clause sentences.
- Register: EU / political / geopolitical / economic Spanish.
- Length: 20–35 words.
- No first-person constructions when source_word is an infinitive.
- Usage must be semantically consistent with the German translation.
- The two new sentences must differ meaningfully from each other AND from the existing sentence.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // 1. Fetch all words that have a sentence but are missing slot 2
  let allWords;
  try {
    const resp = await fetch(`${GAS_URL}?action=getSentences`);
    const data = await resp.json();
    allWords = data.words || [];
  } catch (e) {
    return res.status(500).json({ error: 'Failed to fetch words: ' + e.message });
  }

  const toFill = allWords.filter(w => w.example_sentence && !w.example_sentence_2);
  const total = toFill.length;
  const errors = [];
  let processed = 0;

  // 2. Process in batches of 10 to stay within Vercel's 60s timeout
  const BATCH = 10;
  for (let i = 0; i < toFill.length; i += BATCH) {
    const batch = toFill.slice(i, i + BATCH);

    await Promise.all(batch.map(async (word) => {
      try {
        const prompt = `You are writing example sentences for a Spanish-German vocabulary learning app.

Word: "${word.source_word}"
German translation: "${word.target_word}"
Existing sentence (do NOT reuse or paraphrase this):
"${word.example_sentence}"

Write exactly TWO new, distinct example sentences in Spanish for this word.

${SENTENCE_RULES}

Return ONLY a JSON object with two fields:
{"example_sentence_2": "...", "example_sentence_3": "..."}
No explanation, no markdown.`;

        const response = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 512,
          messages: [{ role: 'user', content: prompt }],
        });

        const text = response.content[0].text.trim();
        const clean = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        const result = JSON.parse(clean);

        if (!result.example_sentence_2 || !result.example_sentence_3) {
          throw new Error('Missing sentence fields in response');
        }

        // 3. Write back to sheet
        await fetch(GAS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({
            action: 'editWord',
            word_id: word.word_id,
            example_sentence_2: result.example_sentence_2,
            example_sentence_3: result.example_sentence_3,
          }),
        });

        processed++;
      } catch (e) {
        errors.push({ word_id: word.word_id, source_word: word.source_word, error: e.message });
      }
    }));
  }

  res.json({ processed, total, errors });
}
