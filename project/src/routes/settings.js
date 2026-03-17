'use strict';

const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const deepseek = require('../utils/deepseek');
const feishu = require('../utils/feishu');
const logger = require('../utils/logger');
const asyncHandler = require('../middleware/asyncHandler');

// 配置 key 白名单
const ALLOWED_KEYS = [
  'feishu_webhook_url',
  'stock_warning_threshold',
  'job_order_enabled',
  'job_stock_enabled',
  'job_report_enabled',
  'deepseek_daily_limit'
];

function getConfig(key) {
  const row = db.prepare('SELECT value FROM config WHERE key=?').get(key);
  return row ? row.value : null;
}

function setConfig(key, value) {
  db.prepare(`
    INSERT INTO config (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP
  `).run(key, String(value));
}

/**
 * GET /api/v1/settings
 * 获取所有配置
 */
router.get('/settings', (req, res) => {
  const result = {};
  for (const key of ALLOWED_KEYS) {
    const val = getConfig(key);
    // 布尔类型转换
    if (key.startsWith('job_')) {
      result[key] = val === null ? true : val === 'true';
    } else if (key === 'stock_warning_threshold' || key === 'deepseek_daily_limit') {
      result[key] = val ? +val : (key === 'stock_warning_threshold' ? 10 : 1000);
    } else {
      result[key] = val || '';
    }
  }
  // AI 今日调用统计
  result.ai_stats = deepseek.getDailyStats();
  res.json({ code: 0, data: result });
});

/**
 * PUT /api/v1/settings
 * 保存配置（批量）
 */
router.put('/settings', (req, res) => {
  const body = req.body || {};
  const updated = [];
  for (const key of ALLOWED_KEYS) {
    if (key in body) {
      setConfig(key, body[key]);
      updated.push(key);
    }
  }
  logger.op('系统设置', `更新配置: ${updated.join(', ')}`);
  res.json({ code: 0, message: '保存成功' });
});

/**
 * POST /api/v1/settings/test-webhook
 * 测试飞书 Webhook
 */
router.post('/settings/test-webhook', asyncHandler(async (req, res) => {
  await feishu.sendMessage('✅ 飞书通知测试成功！来自拼多多店铺管理系统');
  res.json({ code: 0, message: '测试通知已发送' });
}));

/**
 * GET /api/v1/settings/logs
 * 操作日志列表
 */
router.get('/settings/logs', (req, res) => {
  const { page = 1, pageSize = 20 } = req.query;
  const limit = +pageSize;
  const offset = (+page - 1) * limit;

  // 从 config 表读取日志（key 以 log_ 开头）
  const total = db.prepare("SELECT COUNT(*) AS cnt FROM config WHERE key LIKE 'log_%'").get().cnt;
  const list = db.prepare(
    "SELECT key, value, updated_at FROM config WHERE key LIKE 'log_%' ORDER BY updated_at DESC LIMIT ? OFFSET ?"
  ).all(limit, offset).map(row => {
    try {
      return { ...JSON.parse(row.value), created_at: row.updated_at };
    } catch {
      return { action: row.key, detail: row.value, status: 'success', created_at: row.updated_at };
    }
  });

  res.json({ code: 0, data: { list, total } });
});

module.exports = router;
