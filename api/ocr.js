export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64 } = req.body;
  const apiKey = process.env.CLAUDE_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  if (!imageBase64) {
    return res.status(400).json({ error: 'No image provided' });
  }

  const prompt = 'Extract the following information from this warehouse tally sheet:\n' +
    '1. Receipt number (e.g., "WRT-000016633")\n' +
    '2. Customer name\n' +
    '3. Door/location code\n' +
    '4. Date (YYYY-MM-DD format, or leave if unclear)\n' +
    '5. Each line item with: product description, tie/pack size, tier/layers, and total cases\n\n' +
    'Format your response EXACTLY like this:\nRECEIPT: [receipt]\nCUSTOMER: [customer]\nDOOR: [door]\nDATE: [date]\n\nLINES:\n[Line 1: description]\nTie: [number]\nTier: [number]\nCases: [number]\n\n[Line 2: description]\nTie: [number]\nTier: [number]\nCases: [number]\n\n...and so on for each line';

  const data = {
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [{
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 }
      }, {
        type: 'text',
        text: prompt
      }]
    }]
  };

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({ error: 'Claude API error: ' + error });
    }

    const result = await response.json();
    const text = result.content && result.content[0] && result.content[0].text;

    if (!text) {
      return res.status(500).json({ error: 'No response from Claude' });
    }

    res.status(200).json({ text: text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
