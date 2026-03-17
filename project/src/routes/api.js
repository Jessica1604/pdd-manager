'use strict';

const express = require('express');
const router = express.Router();
const orderService = require('../services/order.service');
const goodsService = require('../services/goods.service');
const shopService = require('../services/shop.service');
const feishu = require('../utils/feishu');
const asyncHandler = require('../middleware/asyncHandler');

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
router.post('/shops/:shopId/verify', asyncHandler(async (req, res) => {
  const result = await shopService.verifyShop(+req.params.shopId);
  res.json({ code: result.valid ? 0 : 1, data: result });
}));

// ─── 订单（需传 shopId） ──────────────────────────────────────────────────────

router.post('/sync/orders', asyncHandler(async (req, res) => {
  const { shopId } = req.body;
  if (!shopId) return res.json({ code: 1, message: '请传入 shopId' });
  const result = await orderService.syncOrders(+shopId);
  res.json({ code: 0, data: result });
}));

router.get('/orders', (req, res) => {
  const { shopId, status, startTime, endTime, page = 1, pageSize = 20 } = req.query;
  if (!shopId) return res.json({ code: 1, message: '请传入 shopId' });
  const data = orderService.getLocalOrders(+shopId, { status, startTime, endTime, page: +page, pageSize: +pageSize });
  res.json({ code: 0, data });
});

router.post('/orders/:orderSn/ship', asyncHandler(async (req, res) => {
  const { shopId, trackingNumber } = req.body;
  if (!shopId || !trackingNumber) return res.json({ code: 1, message: 'shopId 和 trackingNumber 必填' });
  await orderService.shipOrder(+shopId, req.params.orderSn, trackingNumber);
  res.json({ code: 0, message: '发货成功' });
}));

router.post('/orders/batch-ship', asyncHandler(async (req, res) => {
  const { shopId, list } = req.body;
  if (!shopId || !Array.isArray(list)) return res.json({ code: 1, message: '参数错误' });
  res.json({ code: 0, data: await orderService.batchShip(+shopId, list) });
}));

// ─── 商品（需传 shopId） ──────────────────────────────────────────────────────

router.post('/sync/goods', asyncHandler(async (req, res) => {
  const { shopId } = req.body;
  if (!shopId) return res.json({ code: 1, message: '请传入 shopId' });
  const count = await goodsService.syncGoods(+shopId);
  res.json({ code: 0, data: { count } });
}));

router.get('/goods', (req, res) => {
  const { shopId, status, keyword, page = 1, pageSize = 20 } = req.query;
  if (!shopId) return res.json({ code: 1, message: '请传入 shopId' });
  const limit = +pageSize;
  const offset = (+page - 1) * limit;
  const { list, total } = goodsService.getLocalGoods(+shopId, { status, keyword, limit, offset });
  res.json({ code: 0, data: { list, total, page: +page, pageSize: limit } });
});

router.put('/goods/:goodsId', asyncHandler(async (req, res) => {
  const { shopId, ...data } = req.body;
  if (!shopId) return res.json({ code: 1, message: '请传入 shopId' });
  await goodsService.updateGoods(+shopId, req.params.goodsId, data);
  res.json({ code: 0, message: '更新成功' });
}));

router.post('/goods/batch-status', asyncHandler(async (req, res) => {
  const { shopId, goodsIds, onSale } = req.body;
  if (!shopId || !Array.isArray(goodsIds)) return res.json({ code: 1, message: '参数错误' });
  res.json({ code: 0, data: await goodsService.batchUpdateStatus(+shopId, goodsIds, onSale) });
}));

// ─── 报表 ─────────────────────────────────────────────────────────────────────

router.post('/report/daily', async (req, res) => {
  try {
    await feishu.sendMessage('📊 手动触发日报（数据分析将在第二阶段实现）');
    res.json({ code: 0, message: '已触发' });
  } catch (err) { res.json({ code: 1, message: err.message }); }
});

module.exports = router;
