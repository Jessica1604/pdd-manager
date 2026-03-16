'use strict';

/**
 * DeepSeek AI 工具
 * - chat: 客服对话（deepseek-chat，低成本）
 * - analyze: 数据分析（deepseek-reasoner，深度推理）
 * 成本控制：关键词匹配优先，AI 兜底；设每日调用上限
 */

const axios = require('axios');
const config = require('../config');
const logger = require('./logger');
const db = require('./db');

const client = axios.create({
  baseURL: config.deepseek.apiUrl,
  headers: {
    Authorization: `Bearer ${config.deepseek.apiKey}`,
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// ─── 调用计数（每日限额） ──────────────────────────────────────────────────────

function getTodayKey() {
  return `deepseek_calls_${new Date().toISOString().slice(0, 10)}`;
}

function getCallCount() {
  const row = db.prepare('SELECT value FROM config WHERE key=?').get(getTodayKey());
  return row ? parseInt(row.value, 10) : 0;
}

function incrCallCount() {
  const key = getTodayKey();
  db.prepare(`
    INSERT INTO config (key, value) VALUES (?, '1')
    ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT)
  `).run(key);
}

function isOverLimit() {
  return getCallCount() >= config.deepseek.dailyLimit;
}

// ─── 核心调用 ─────────────────────────────────────────────────────────────────

async function callApi(model, messages, maxTokens = 500) {
  if (isOverLimit()) {
    logger.warn(`[DeepSeek] 今日调用已达上限 ${config.deepseek.dailyLimit}`);
    throw new Error('AI 今日调用次数已达上限');
  }
  try {
    const res = await client.post('/chat/completions', { model, messages, max_tokens: maxTokens });
    incrCallCount();
    return res.data.choices[0].message.content.trim();
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    logger.error(`[DeepSeek] 调用失败: ${msg}`);
    throw new Error(`AI 服务异常: ${msg}`);
  }
}

/**
 * 客服对话（deepseek-chat）
 * @param {string} userMessage  客户消息
 * @param {object} context      { faq, orderInfo }
 */
async function chat(userMessage, context = {}) {
  const { faq = '', orderInfo = '' } = context;
  const systemPrompt = [
    '你是拼多多店铺专业客服，回复简洁友好，不超过 150 字。',
    '店铺规则：下单后 48 小时内发货，7 天无理由退换，物流使用圆通快递。',
    faq ? `\n常见问题：\n${faq}` : '',
    orderInfo ? `\n买家订单信息：\n${orderInfo}` : '',
  ].filter(Boolean).join('');

  return callApi(config.deepseek.chatModel, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ], 200);
}

/**
 * 数据分析（deepseek-reasoner）
 * @param {object} salesData  销售数据
 */
async function analyzeSales(salesData) {
  const prompt = `请分析以下拼多多店铺销售数据，给出简洁的经营建议（300字以内）：

${JSON.stringify(salesData, null, 2)}

请输出：
1. 数据亮点
2. 存在问题
3. 改进建议`;

  return callApi(config.deepseek.reasonerModel, [
    { role: 'user', content: prompt },
  ], 800);
}

/** 获取今日调用次数 */
function getDailyStats() {
  return { used: getCallCount(), limit: config.deepseek.dailyLimit };
}

module.exports = { chat, analyzeSales, getDailyStats };
