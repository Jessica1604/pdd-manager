'use strict';

const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const analyticsService = require('../services/analytics.service');
const cache = require('../utils/cache');
const asyncHandler = require('../middleware/asyncHandler');

router.get('/dashboard/summary', asyncHandler(async (req, res) => {
  const { shopId } = req.query;
  if (!shopId) return res.json({ code: 1, message: '请传入 shopId' });

  const data = await cache.wrap(`dashboard:summary:${shopId}`, () => {
    const today = new Date().toISOString().slice(0, 10);
    const summary = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN status != 'refund' THEN total_amount ELSE 0 END), 0) AS todaySales,
        COUNT(*)                                                                      AS todayOrders,
        COUNT(CASE WHEN status = 'refund' THEN 1 END)                                AS todayRefunds
      FROM orders WHERE shop_id = ? AND DATE(created_at) = ?
    `).get(+shopId, today);
    const { cnt } = db.prepare(
      "SELECT COUNT(*) AS cnt FROM goods WHERE shop_id = ? AND stock <= 10 AND status = 'on'"
    ).get(+shopId);
    return {
      todaySales: +summary.todaySales.toFixed(2),
      todayOrders: summary.todayOrders,
      todayRefunds: summary.todayRefunds,
      stockWarnings: cnt
    };
  }, 60_000);

  res.json({ code: 0, data });
}));

router.get('/dashboard/trend', asyncHandler(async (req, res) => {
  const { shopId, days = 7 } = req.query;
  if (!shopId) return res.json({ code: 1, message: '请传入 shopId' });
  const data = await cache.wrap(
    `dashboard:trend:${shopId}:${days}`,
    () => analyticsService.getDailyTrend(+shopId, +days),
    5 * 60_000
  );
  res.json({ code: 0, data });
}));

router.get('/dashboard/top-goods', asyncHandler(async (req, res) => {
  const { shopId, days = 30 } = req.query;
  if (!shopId) return res.json({ code: 1, message: '请传入 shopId' });
  const data = await cache.wrap(
    `dashboard:top-goods:${shopId}:${days}`,
    () => {
      const endDate = new Date().toISOString().slice(0, 10);
      const startDate = new Date(Date.now() - +days * 86400000).toISOString().slice(0, 10);
      return analyticsService.getTopGoods(+shopId, startDate, endDate, 10).map(r => {
        let name = '未知商品';
        try { name = JSON.parse(r.goods_info)[0]?.goods_name || name; } catch {}
        return { name, sales: r.orderCount, amount: +r.totalAmount.toFixed(2) };
      });
    },
    10 * 60_000
  );
  res.json({ code: 0, data });
}));

router.get('/dashboard/stock-warnings', asyncHandler(async (req, res) => {
  const { shopId } = req.query;
  if (!shopId) return res.json({ code: 1, message: '请传入 shopId' });
  const data = await cache.wrap(
    `dashboard:stock-warnings:${shopId}`,
    () => db.prepare(
      "SELECT goods_id, goods_name, stock, status FROM goods WHERE shop_id=? AND stock<=10 AND status='on' ORDER BY stock ASC LIMIT 20"
    ).all(+shopId),
    2 * 60_000
  );
  res.json({ code: 0, data });
}));

module.exports = router;


module.exports = router;
