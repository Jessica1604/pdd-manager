'use strict';

/**
 * 客服服务
 * 优先级：关键词匹配 → AI 回复 → 兜底话术
 */

const db = require('../utils/db');
const deepseek = require('../utils/deepseek');
const logger = require('../utils/logger');

// ─── 数据库初始化（客服相关表） ───────────────────────────────────────────────

db.exec(`
  -- 关键词规则表
  CREATE TABLE IF NOT EXISTS cs_rules (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id  INTEGER NOT NULL DEFAULT 0,
    keyword  TEXT NOT NULL,
    reply    TEXT NOT NULL,
    priority INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 回复模板表
  CREATE TABLE IF NOT EXISTS cs_templates (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id  INTEGER NOT NULL DEFAULT 0,
    name     TEXT NOT NULL,
    content  TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- AI 回复缓存表（相同问题复用，节省费用）
  CREATE TABLE IF NOT EXISTS cs_ai_cache (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id    INTEGER NOT NULL DEFAULT 0,
    question   TEXT NOT NULL,
    answer     TEXT NOT NULL,
    hit_count  INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(shop_id, question)
  );
`);

// ─── 关键词匹配 ───────────────────────────────────────────────────────────────

function matchKeyword(shopId, message) {
  const rules = db.prepare(
    'SELECT * FROM cs_rules WHERE shop_id=? ORDER BY priority DESC'
  ).all(shopId);

  for (const rule of rules) {
    if (message.includes(rule.keyword)) return rule.reply;
  }
  return null;
}

// ─── AI 缓存 ──────────────────────────────────────────────────────────────────

function getCache(shopId, question) {
  const row = db.prepare(
    'SELECT answer FROM cs_ai_cache WHERE shop_id=? AND question=?'
  ).get(shopId, question);
  if (row) {
    db.prepare('UPDATE cs_ai_cache SET hit_count=hit_count+1 WHERE shop_id=? AND question=?')
      .run(shopId, question);
    return row.answer;
  }
  return null;
}

function setCache(shopId, question, answer) {
  db.prepare(`
    INSERT INTO cs_ai_cache (shop_id, question, answer)
    VALUES (?, ?, ?)
    ON CONFLICT(shop_id, question) DO UPDATE SET answer=excluded.answer, hit_count=hit_count+1
  `).run(shopId, question, answer);
}

// ─── 核心：处理一条客服消息 ───────────────────────────────────────────────────

/**
 * @param {number} shopId
 * @param {string} userId       买家 ID
 * @param {string} message      买家消息
 * @param {object} context      { orderInfo }  可选，传入订单上下文
 * @returns {{ reply, replyType }}
 */
async function handleMessage(shopId, userId, message, context = {}) {
  let reply = null;
  let replyType = 'auto';

  // 1. 关键词匹配（不消耗 AI 额度）
  reply = matchKeyword(shopId, message);
  if (reply) {
    replyType = 'auto';
    logger.info(`[客服] shop=${shopId} 关键词命中: "${message.slice(0, 20)}"`);
  }

  // 2. AI 缓存命中
  if (!reply) {
    reply = getCache(shopId, message);
    if (reply) {
      replyType = 'ai_cache';
      logger.info(`[客服] shop=${shopId} AI 缓存命中`);
    }
  }

  // 3. 调用 DeepSeek
  if (!reply) {
    try {
      const faq = getFaq(shopId);
      reply = await deepseek.chat(message, { faq, orderInfo: context.orderInfo || '' });
      replyType = 'ai';
      setCache(shopId, message, reply);
      logger.info(`[客服] shop=${shopId} AI 回复生成`);
    } catch (err) {
      // AI 失败兜底
      reply = '您好，您的问题我们已收到，客服人员将尽快为您处理，请稍候。';
      replyType = 'fallback';
      logger.warn(`[客服] shop=${shopId} AI 失败，使用兜底: ${err.message}`);
    }
  }

  // 记录消息
  db.prepare(`
    INSERT INTO customer_messages (shop_id, user_id, message, reply, reply_type)
    VALUES (?, ?, ?, ?, ?)
  `).run(shopId, userId, message, reply, replyType);

  return { reply, replyType };
}

// ─── FAQ 拼接 ─────────────────────────────────────────────────────────────────

function getFaq(shopId) {
  const rules = db.prepare(
    'SELECT keyword, reply FROM cs_rules WHERE shop_id=? ORDER BY priority DESC LIMIT 20'
  ).all(shopId);
  return rules.map(r => `Q: ${r.keyword}\nA: ${r.reply}`).join('\n');
}

// ─── 规则管理 ─────────────────────────────────────────────────────────────────

function listRules(shopId) {
  return db.prepare('SELECT * FROM cs_rules WHERE shop_id=? ORDER BY priority DESC').all(shopId);
}

function addRule(shopId, { keyword, reply, priority = 0 }) {
  if (!keyword || !reply) throw new Error('keyword 和 reply 必填');
  return db.prepare(
    'INSERT INTO cs_rules (shop_id, keyword, reply, priority) VALUES (?,?,?,?)'
  ).run(shopId, keyword, reply, priority).lastInsertRowid;
}

function updateRule(id, { keyword, reply, priority }) {
  const fields = [], vals = [];
  if (keyword)  { fields.push('keyword=?');  vals.push(keyword); }
  if (reply)    { fields.push('reply=?');    vals.push(reply); }
  if (priority !== undefined) { fields.push('priority=?'); vals.push(priority); }
  if (!fields.length) throw new Error('无可更新字段');
  vals.push(id);
  db.prepare(`UPDATE cs_rules SET ${fields.join(',')} WHERE id=?`).run(...vals);
}

function deleteRule(id) {
  db.prepare('DELETE FROM cs_rules WHERE id=?').run(id);
}

// ─── 模板管理 ─────────────────────────────────────────────────────────────────

function listTemplates(shopId) {
  return db.prepare('SELECT * FROM cs_templates WHERE shop_id=?').all(shopId);
}

function addTemplate(shopId, { name, content }) {
  if (!name || !content) throw new Error('name 和 content 必填');
  return db.prepare(
    'INSERT INTO cs_templates (shop_id, name, content) VALUES (?,?,?)'
  ).run(shopId, name, content).lastInsertRowid;
}

function deleteTemplate(id) {
  db.prepare('DELETE FROM cs_templates WHERE id=?').run(id);
}

// ─── 统计 ─────────────────────────────────────────────────────────────────────

function getDailyStats(shopId, date) {
  const d = date || new Date().toISOString().slice(0, 10);
  const rows = db.prepare(`
    SELECT reply_type, COUNT(*) as count
    FROM customer_messages
    WHERE shop_id=? AND DATE(created_at)=?
    GROUP BY reply_type
  `).all(shopId, d);

  const stats = { auto: 0, ai: 0, ai_cache: 0, fallback: 0, manual: 0, total: 0 };
  for (const r of rows) { stats[r.reply_type] = r.count; stats.total += r.count; }
  return stats;
}

function getTopQuestions(shopId, limit = 10) {
  return db.prepare(`
    SELECT message, COUNT(*) as count
    FROM customer_messages WHERE shop_id=?
    GROUP BY message ORDER BY count DESC LIMIT ?
  `).all(shopId, limit);
}

function getMessages(shopId, { limit = 50, offset = 0, replyType } = {}) {
  if (replyType) {
    return db.prepare(
      'SELECT * FROM customer_messages WHERE shop_id=? AND reply_type=? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(shopId, replyType, limit, offset);
  }
  return db.prepare(
    'SELECT * FROM customer_messages WHERE shop_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(shopId, limit, offset);
}

module.exports = {
  handleMessage,
  listRules, addRule, updateRule, deleteRule,
  listTemplates, addTemplate, deleteTemplate,
  getDailyStats, getTopQuestions, getMessages,
};
