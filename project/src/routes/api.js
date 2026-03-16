'use strict';

const express = require('express');
const router = express.Router();
const orderService = require('../services/order.service');
const goodsService = require('../services/goods.service');
const shopService = require('../services/shop.service');
const feishu = require('../utils/feishu');

// ─── 店铺管理 ─────────────────────────────────────────────────────────────────

// 获取所有店铺
router.get('/shops', (req, res) => {
  res.json({ code: 0, data: shopService.listShops() });
});

// 添加店铺
router.post('/shops', (req, res) => {
  try {
    const id = shopService.addShop(req.body);
    res.json({ code: 0, data: { id }, message: '店铺添加成功' });
  } catch (err) {
    res.json({ code: 1, message: err.message });
  }
});

// 更新店铺
router.put('/shops/:shopId', (req, res) => {
  try {
    shopService.updateShop(+req.params.shopId, req.body);
    res.json({ code: 0, message: '更新成功' });
  } catch (err) {
    res.json({ code: 1, message: err.message });
  }
});

// 禁用店铺
router.delete('/shops/:shopId', (req, res) => {
  shopService.disableShop(+req.params.shopId);
  res.json({ code: 0, message: '已禁用' });
});

// 验证店铺凭证
router.post('/shops/:shopId/verify', async (req, res) => {
  const result = await shopService.verifyShop(+req.params.shopId);
  res.json({ code: result.valid ? 0 : 1, data: result });
});

// ─── 订单（需传 shopId） ──────────────────────────────────────────────────────

router.post('/sync/orders', async (req, res) => {
  const { shopId } = req.body;
  if (!shopId) return res.json({ code: 1, message: '请传入 shopId' });
  try {
    const result = await orderService.syncOrders(+shopId);
    res.json({ code: 0, data: result });
  } catch (err) { res.json({ code: 1, message: err.message }); }
});

router.get('/orders', (req, res) => {
  const { shopId, status, limit, offset } = req.query;
  if (!shopId) return res.json({ code: 1, message: '请传入 shopId' });
  res.json({ code: 0, data: orderService.getLocalOrders(+shopId, { status, limit: +limit || 50, offset: +offset || 0 }) });
});

router.post('/orders/:orderSn/ship', async (req, res) => {
  const { shopId, trackingNumber } = req.body;
  if (!shopId || !trackingNumber) return res.json({ code: 1, message: 'shopId 和 trackingNumber 必填' });
  try {
    await orderService.shipOrder(+shopId, req.params.orderSn, trackingNumber);
    res.json({ code: 0, message: '发货成功' });
  } catch (err) { res.json({ code: 1, message: err.message }); }
});

router.post('/orders/batch-ship', async (req, res) => {
  const { shopId, list } = req.body;
  if (!shopId || !Array.isArray(list)) return res.json({ code: 1, message: '参数错误' });
  try {
    res.json({ code: 0, data: await orderService.batchShip(+shopId, list) });
  } catch (err) { res.json({ code: 1, message: err.message }); }
});

// ─── 商品（需传 shopId） ──────────────────────────────────────────────────────

router.post('/sync/goods', async (req, res) => {
  const { shopId } = req.body;
  if (!shopId) return res.json({ code: 1, message: '请传入 shopId' });
  try {
    const count = await goodsService.syncGoods(+shopId);
    res.json({ code: 0, data: { count } });
  } catch (err) { res.json({ code: 1, message: err.message }); }
});

router.get('/goods', (req, res) => {
  const { shopId, status, limit, offset } = req.query;
  if (!shopId) return res.json({ code: 1, message: '请传入 shopId' });
  res.json({ code: 0, data: goodsService.getLocalGoods(+shopId, { status, limit: +limit || 100, offset: +offset || 0 }) });
});

router.put('/goods/:goodsId', async (req, res) => {
  const { shopId, ...data } = req.body;
  if (!shopId) return res.json({ code: 1, message: '请传入 shopId' });
  try {
    await goodsService.updateGoods(+shopId, req.params.goodsId, data);
    res.json({ code: 0, message: '更新成功' });
  } catch (err) { res.json({ code: 1, message: err.message }); }
});

router.post('/goods/batch-status', async (req, res) => {
  const { shopId, goodsIds, onSale } = req.body;
  if (!shopId || !Array.isArray(goodsIds)) return res.json({ code: 1, message: '参数错误' });
  try {
    res.json({ code: 0, data: await goodsService.batchUpdateStatus(+shopId, goodsIds, onSale) });
  } catch (err) { res.json({ code: 1, message: err.message }); }
});

// ─── 报表 ─────────────────────────────────────────────────────────────────────

router.post('/report/daily', async (req, res) => {
  try {
    await feishu.sendMessage('📊 手动触发日报（数据分析将在第二阶段实现）');
    res.json({ code: 0, message: '已触发' });
  } catch (err) { res.json({ code: 1, message: err.message }); }
});

module.exports = router;
