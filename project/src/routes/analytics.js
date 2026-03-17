'use strict';

const express = require('express');
const router = express.Router();
const customerService = require('../services/customer.service');
const analyticsService = require('../services/analytics.service');
const deepseek = require('../utils/deepseek');
const shopService = require('../services/shop.service');
const asyncHandler = require('../middleware/asyncHandler');

// ═══════════════════════════════════════════════════════
// 客服管理
// ═══════════════════════════════════════════════════════

// 处理客服消息（核心接口）
router.post('/customer/message', asyncHandler(async (req, res) => {
  const { shopId, userId, message, orderInfo } = req.body;
  if (!shopId || !userId || !message) {
    return res.json({ code: 1, message: 'shopId / userId / message 必填' });
  }
  const result = await customerService.handleMessage(+shopId, userId, message, { orderInfo });
  res.json({ code: 0, data: result });
}));

// 消息记录列表
router.get('/customer/messages', (req, res) => {
  const { shopId, replyType, limit, offset } = req.query;
  if (!shopId) return res.json({ code: 1, message: '请传入 shopId' });
  res.json({
    code: 0,
    data: customerService.getMessages(+shopId, {
      replyType, limit: +limit || 50, offset: +offset || 0,
    }),
  });
});

// 客服统计
router.get('/customer/stats', (req, res) => {
  const { shopId, date } = req.query;
  if (!shopId) return res.json({ code: 1, message: '请传入 shopId' });
  res.json({ code: 0, data: customerService.getDailyStats(+shopId, date) });
});

// 常见问题 TOP
router.get('/customer/top-questions', (req, res) => {
  const { shopId, limit } = req.query;
  if (!shopId) return res.json({ code: 1, message: '请传入 shopId' });
  res.json({ code: 0, data: customerService.getTopQuestions(+shopId, +limit || 10) });
});

// ── 关键词规则 ──────────────────────────────────────────

router.get('/customer/rules', (req, res) => {
  const { shopId } = req.query;
  if (!shopId) return res.json({ code: 1, message: '请传入 shopId' });
  res.json({ code: 0, data: customerService.listRules(+shopId) });
});

router.post('/customer/rules', (req, res) => {
  const { shopId, keyword, reply, priority } = req.body;
  if (!shopId) return res.json({ code: 1, message: '请传入 shopId' });
  try {
    const id = customerService.addRule(+shopId, { keyword, reply, priority });
    res.json({ code: 0, data: { id }, message: '规则添加成功' });
  } catch (err) {
    res.json({ code: 1, message: err.message });
  }
});

router.put('/customer/rules/:id', (req, res) => {
  try {
    customerService.updateRule(+req.params.id, req.body);
    res.json({ code: 0, message: '更新成功' });
  } catch (err) {
    res.json({ code: 1, message: err.message });
  }
});

router.delete('/customer/rules/:id', (req, res) => {
  customerService.deleteRule(+req.params.id);
  res.json({ code: 0, message: '已删除' });
});

// ── 回复模板 ────────────────────────────────────────────

router.get('/customer/templates', (req, res) => {
  const { shopId } = req.query;
  if (!shopId) return res.json({ code: 1, message: '请传入 shopId' });
  res.json({ code: 0, data: customerService.listTemplates(+shopId) });
});

router.post('/customer/templates', (req, res) => {
  const { shopId, name, content } = req.body;
  if (!shopId) return res.json({ code: 1, message: '请传入 shopId' });
  try {
    const id = customerService.addTemplate(+shopId, { name, content });
    res.json({ code: 0, data: { id }, message: '模板添加成功' });
  } catch (err) {
    res.json({ code: 1, message: err.message });
  }
});

router.delete('/customer/templates/:id', (req, res) => {
  customerService.deleteTemplate(+req.params.id);
  res.json({ code: 0, message: '已删除' });
});

// ═══════════════════════════════════════════════════════
// 数据分析
// ═══════════════════════════════════════════════════════

// 销售汇总
router.get('/analytics/summary', (req, res) => {
  const { shopId, startDate, endDate } = req.query;
  if (!shopId || !startDate || !endDate) {
    return res.json({ code: 1, message: 'shopId / startDate / endDate 必填' });
  }
  res.json({ code: 0, data: analyticsService.getSalesSummary(+shopId, startDate, endDate) });
});

// 销售趋势
router.get('/analytics/trend', (req, res) => {
  const { shopId, days } = req.query;
  if (!shopId) return res.json({ code: 1, message: '请传入 shopId' });
  res.json({ code: 0, data: analyticsService.getDailyTrend(+shopId, +days || 7) });
});

// 热销商品
router.get('/analytics/top-goods', (req, res) => {
  const { shopId, startDate, endDate, limit } = req.query;
  if (!shopId || !startDate || !endDate) {
    return res.json({ code: 1, message: 'shopId / startDate / endDate 必填' });
  }
  res.json({ code: 0, data: analyticsService.getTopGoods(+shopId, startDate, endDate, +limit || 10) });
});

// 库存分析
router.get('/analytics/stock', (req, res) => {
  const { shopId } = req.query;
  if (!shopId) return res.json({ code: 1, message: '请传入 shopId' });
  res.json({ code: 0, data: analyticsService.getStockAnalysis(+shopId) });
});

// 手动触发 AI 洞察
router.post('/analytics/ai-insight', asyncHandler(async (req, res) => {
  const { shopId, date } = req.body;
  if (!shopId) return res.json({ code: 1, message: '请传入 shopId' });
  const insight = await analyticsService.generateAiInsight(+shopId, date);
  res.json({ code: 0, data: { insight } });
}));

// 手动触发日报
router.post('/report/daily', asyncHandler(async (req, res) => {
  const { shopId } = req.body;
  if (!shopId) return res.json({ code: 1, message: '请传入 shopId' });
  const shop = shopService.getShop(+shopId);
  if (!shop) return res.json({ code: 1, message: '店铺不存在' });
  const result = await analyticsService.sendDailyReport(+shopId, shop.name);
  res.json({ code: 0, data: result, message: '日报已推送' });
}));

// 手动触发周报
router.post('/report/weekly', asyncHandler(async (req, res) => {
  const { shopId } = req.body;
  if (!shopId) return res.json({ code: 1, message: '请传入 shopId' });
  const shop = shopService.getShop(+shopId);
  if (!shop) return res.json({ code: 1, message: '店铺不存在' });
  await analyticsService.sendWeeklyReport(+shopId, shop.name);
  res.json({ code: 0, message: '周报已推送' });
}));

// DeepSeek 调用统计
router.get('/analytics/ai-stats', (req, res) => {
  res.json({ code: 0, data: deepseek.getDailyStats() });
});

module.exports = router;
