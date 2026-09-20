// netlify/functions/parse-card.js
//
// Receives a resized/base64 business-card photo from the client, sends it to
// Claude for vision-based extraction, and returns structured contact fields.
// The image is never persisted — it's used for this one API call and discarded.
//
// Requires an ANTHROPIC_API_KEY environment variable set in
// Netlify: Site settings → Environment variables.

const ANTHROPIC_MODEL = 'claude-sonnet-5';
const MAX_IMAGE_BASE64_CHARS = 6_000_000; // ~4.5MB decoded; keeps us well under function payload limits

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { image, mediaType } = body;
  if (!image || !mediaType) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing image or mediaType' }) };
  }
  if (image.length > MAX_IMAGE_BASE64_CHARS) {
    return { statusCode: 413, body: JSON.stringify({ error: 'Image too large' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY is not set');
    return { statusCode: 500, body: JSON.stringify({ error: 'Card scanning is not configured on the server' }) };
  }

  const prompt = `You are reading a photo of a business card. Extract the contact's information and return ONLY a JSON object, with no markdown fences and no commentary, matching exactly this shape:
{"first_name": "", "last_name": "", "company": "", "role": "", "phone": "", "email": ""}

Rules:
- If a field isn't visible on the card, return it as an empty string. Never guess or invent information.
- "role" is the person's job title (e.g. "VP of Legal Operations"), not the company name.
- If multiple phone numbers are printed, prefer the mobile/cell number; otherwise use the first one listed. Keep the formatting as printed.
- If multiple emails are printed, use the first one.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 400,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
              { type: 'text', text: prompt }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', response.status, errText);
      return { statusCode: 502, body: JSON.stringify({ error: 'Card parsing service error' }) };
    }

    const data = await response.json();
    const raw = (data.content || []).map((b) => b.text || '').join('').trim();
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('Could not parse model output as JSON:', raw);
      return { statusCode: 502, body: JSON.stringify({ error: 'Could not read that card — try a clearer photo' }) };
    }

    const fields = ['first_name', 'last_name', 'company', 'role', 'phone', 'email'];
    const result = {};
    fields.forEach((f) => {
      result[f] = typeof parsed[f] === 'string' ? parsed[f].trim() : '';
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result)
    };
  } catch (err) {
    console.error('parse-card error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Unexpected server error' }) };
  }
};
