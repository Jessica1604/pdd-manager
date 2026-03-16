require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  pdd: {
    clientId: process.env.PDD_CLIENT_ID,
    clientSecret: process.env.PDD_CLIENT_SECRET,
    accessToken: process.env.PDD_ACCESS_TOKEN,
    apiUrl: 'https://gw-api.pinduoduo.com/api/router',
  },

  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY,
    apiUrl: 'https://api.deepseek.com/v1',
    chatModel: 'deepseek-chat',
    reasonerModel: 'deepseek-reasoner',
    dailyLimit: 1000,
  },

  feishu: {
    webhookUrl: process.env.FEISHU_WEBHOOK_URL,
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'change-me',
    expiresIn: '7d',
  },

  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
  },

  logistics: {
    provider: '圆通快递',
    code: 'yuantong',
  },

  stock: {
    warningThreshold: 10,
  },
};
