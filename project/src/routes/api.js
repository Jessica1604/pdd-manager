'use strict';

const express = require('express');
const router = express.Router();
const orderService = require('../services/order.service');
const goodsService = require('../services/goods.service');
const pdd = require('../api/pdd-client');
const feishu = require('../utils/feishu');
const logger = require('../utils/logger');

// ─── 订单 ─────────────────────────────────────────────────────────────────────

// 手动同步订单
router.post('/sync/orders', async (req, res) => {
  try {
    const result = await orderService.syncOrders();
    res.json({ code: 0, data: result, message: 'ok' });
  } catch (err) {
    res.json({ code: 1, message: err.message });
  }
});

// 查询本地订单列表
router.get('/orders', (req, res) => {
  const { status, limit, offset } = req.query;
  const data = orderService.getLocalOrders({ status, limit: +limit || 50, offset: +offset || 0 });
  res.json({ code: 0, data });
});

// 单笔发货
router.post('/orders/:orderSn/ship', async (req, res) => {
  const { orderSn } = req.params;
  const { trackingNumber } = req.body;
  if (!trackingNumber) return res.json({ code: 1, message: '请提供圆通快递单号' });
  try {
    await orderService.shipOrder(orderSn, trackingNumber);
    res.json({ code: 0, message: '发货成功' });
  } catch (err) {
    res.json({ code: 1, message: err.message });
  }
});

// 批量发货
router.post('/orders/batch-ship', async (req, res) => {
  const { list } = req.body; // [{orderSn, trackingNumber}]
  if (!Array.isArray(list) || list.length === 0) return res.json({ code: 1, message: '参数错误' });
  try {
    const results = await orderService.batchShip(list);
    res.json({ code: 0, data: results });
  } catch (err) {
    res.json({ code: 1, message: err.message });
  }
});

// 订单详情
router.get('/orders/:orderSn', async (req, res) => {
  try {
    const data = await pdd.getOrderDetail(req.params.orderSn);
    res.json({ code: 0, data });
  } catch (err) {
    res.json({ code: 1, message: err.message });
  }
});

// ─── 商品 ─────────────────────────────────────────────────────────────────────

// 手动同步商品
router.post('/sync/goods', async (req, res) => {
  try {
    const count = await goodsService.syncGoods();
    res.json({ code: 0, data: { count }, message: 'ok' });
  } catch (err) {
    res.json({ code: 1, message: err.message });
  }
});

// 查询本地商品列表
router.get('/goods', (req, res) => {
  const { status, limit, offset } = req.query;
  const data = goodsService.getLocalGoods({ status, limit: +limit || 100, offset: +offset || 0 });
  res.json({ code: 0, data });
});

// 更新商品
router.put('/goods/:goodsId', async (req, res) => {
  try {
    await goodsService.updateGoods(req.params.goodsId, req.body);
    res.json({ code: 0, message: '更新成功' });
  } catch (err) {
    res.json({ code: 1, message: err.message });
  }
});

// 批量上下架
router.post('/goods/batch-status', async (req, res) => {
  const { goodsIds, onSale } = req.body;
  if (!Array.isArray(goodsIds)) return res.json({ code: 1, message: '参数错误' });
  try {
    const results = await goodsService.batchUpdateStatus(goodsIds, onSale);
    res.json({ code: 0, data: results });
  } catch (err) {
    res.json({ code: 1, message: err.message });
  }
});

// ─── 报表 ─────────────────────────────────────────────────────────────────────

// 手动生成日报
router.post('/report/daily', async (req, res) => {
  try {
    await feishu.sendMessage('📊 手动触发日报生成（数据分析功能将在第二阶段实现）');
    res.json({ code: 0, message: '日报已触发' });
  } catch (err) {
    res.json({ code: 1, message: err.message });
  }
});

module.exports = router;
