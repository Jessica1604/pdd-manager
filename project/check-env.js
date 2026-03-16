'use strict';

require('dotenv').config();
const https = require('https');
const http = require('http');

function request(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.request(url, { method: opts.method || 'GET', headers: opts.headers || {}, timeout: 8000 }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('超时')); });
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

async function check(name, fn) {
  try {
    const msg = await fn();
    console.log(`  ✅ ${name}: ${msg}`);
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message}`);
  }
}

(async () => {
  console.log('\n=== .env 配置连通性验证 ===\n');

  // 1. 检查必填项
  console.log('【1】环境变量检查');
  const vars = ['PDD_CLIENT_ID','PDD_CLIENT_SECRET','PDD_ACCESS_TOKEN','DEEPSEEK_API_KEY','FEISHU_WEBHOOK_URL','JWT_SECRET'];
  for (const v of vars) {
    if (process.env[v]) console.log(`  ✅ ${v} 已配置`);
    else console.log(`  ❌ ${v} 未配置`);
  }

  // 2. DeepSeek API
  console.log('\n【2】DeepSeek API 连通测试');
  await check('DeepSeek API', async () => {
    const body = JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 });
    const res = await request('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
      body,
    });
    const json = JSON.parse(res.body);
    if (json.error) throw new Error(json.error.message);
    return `连接成功，模型: ${json.model}`;
  });

  // 3. 飞书 Webhook
  console.log('\n【3】飞书 Webhook 测试');
  await check('飞书 Webhook', async () => {
    if (!process.env.FEISHU_WEBHOOK_URL) throw new Error('未配置');
    const body = JSON.stringify({ msg_type: 'text', content: { text: '✅ 拼多多管理系统配置验证消息' } });
    const res = await request(process.env.FEISHU_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const json = JSON.parse(res.body);
    if (json.code !== 0) throw new Error(`飞书返回错误: ${json.msg}`);
    return '发送成功，请查看飞书群消息';
  });

  // 4. 拼多多 API（签名验证）
  console.log('\n【4】拼多多 API 签名测试');
  await check('拼多多 API', async () => {
    const crypto = require('crypto');
    const params = {
      type: 'pdd.time.get',
      client_id: process.env.PDD_CLIENT_ID,
      timestamp: Math.floor(Date.now() / 1000),
      data_type: 'JSON',
      version: 'V1',
    };
    const sorted = Object.keys(params).sort().map(k => `${k}${params[k]}`).join('');
    params.sign = crypto.createHash('md5')
      .update(`${process.env.PDD_CLIENT_SECRET}${sorted}${process.env.PDD_CLIENT_SECRET}`)
      .digest('hex').toUpperCase();

    const qs = Object.entries(params).map(([k,v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    const res = await request(`https://gw-api.pinduoduo.com/api/router?${qs}`);
    const json = JSON.parse(res.body);
    if (json.error_response) {
      const code = json.error_response.error_code;
      if (code === 10038) throw new Error('限流，稍后重试');
      if (code === 10007) throw new Error('access_token 无效，请重新授权');
      if (code === 10001) throw new Error('client_id 或 client_secret 错误');
      throw new Error(`${json.error_response.error_msg}`);
    }
    return `连接成功，服务器时间: ${json.time_get_response?.time || '已返回'}`;
  });

  console.log('\n=== 验证完成 ===\n');
})();
