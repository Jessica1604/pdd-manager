const axios = require('axios');
const config = require('../config');

async function sendMessage(content) {
  if (!config.feishu.webhookUrl) return;
  try {
    await axios.post(config.feishu.webhookUrl, {
      msg_type: 'text',
      content: { text: content },
    });
  } catch (err) {
    console.error('[Feishu] 发送失败:', err.message);
  }
}

async function sendCard(title, content) {
  if (!config.feishu.webhookUrl) return;
  try {
    await axios.post(config.feishu.webhookUrl, {
      msg_type: 'interactive',
      card: {
        header: { title: { tag: 'plain_text', content: title } },
        elements: [{ tag: 'div', text: { tag: 'lark_md', content } }],
      },
    });
  } catch (err) {
    console.error('[Feishu] 发送卡片失败:', err.message);
  }
}

module.exports = { sendMessage, sendCard };
