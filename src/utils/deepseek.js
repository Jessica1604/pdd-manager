const axios = require('axios');
const config = require('../config');

const client = axios.create({
  baseURL: config.deepseek.apiUrl,
  headers: { Authorization: `Bearer ${config.deepseek.apiKey}` },
});

async function chat(prompt, model = config.deepseek.chatModel) {
  const res = await client.post('/chat/completions', {
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 500,
  });
  return res.data.choices[0].message.content;
}

async function analyze(prompt) {
  return chat(prompt, config.deepseek.reasonerModel);
}

module.exports = { chat, analyze };
