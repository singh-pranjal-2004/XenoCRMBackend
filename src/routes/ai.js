const express = require('express');
const router = express.Router();
const { GoogleGenAI } = require('@google/genai');
const axios = require('axios');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// POST /api/ai/message-suggestions
router.post('/message-suggestions', async (req, res) => {
  const { objective, audienceDescription } = req.body;
  const prompt = `You are a marketing copywriter. Write 3 short, catchy message variants for this campaign objective: "${objective}".${audienceDescription ? ` Audience: ${audienceDescription}` : ''} Messages:`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });
    const text = response.text;
    const suggestions = text
      .split('\n')
      .map(line => line.replace(/^[0-9]+\.\s*/, '').trim())
      .filter(line => line.length > 0);
    res.json({ suggestions });
  } catch (err) {
    console.error('GEMINI SUGGESTION ERROR:', err);
    res.status(500).json({ error: err.message || 'Gemini suggestion failed' });
  }
});

router.post('/dashboard-insight', async (req, res) => {
  const { stats } = req.body;
  if (!stats) return res.status(400).json({ error: 'Missing stats' });

  try {
    const prompt = `
      Here are some CRM dashboard stats:
      - Total customers: ${stats.customers}
      - Active campaigns: ${stats.campaigns}
      - Campaign reach: ${stats.reach}
      Please generate a concise, actionable insight for a CRM manager.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });
    const text = response.text;
    res.json({ insight: text });
  } catch (err) {
    console.error('Gemini API error:', err);
    res.status(500).json({ error: 'Failed to generate insight' });
  }
});

module.exports = router; 