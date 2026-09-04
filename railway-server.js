const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.post('/api/ocr', async (req, res) => {
  try {
    if (!CLAUDE_API_KEY) {
      return res.status(500).json({ error: 'API key not configured on server' });
    }

    const { imageBase64 } = req.body;
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

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
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

    res.json({ text: text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => {
  res.json({ message: 'Skid Tracker OCR Backend', status: 'running' });
});

app.listen(PORT, () => {
  console.log(`OCR server running on port ${PORT}`);
});
