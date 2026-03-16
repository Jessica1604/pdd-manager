const express = require('express');
const router = express.Router();
const pdd = require('../api/pdd-client');
const feishu = require('../utils/feishu');

// 手动同步订单
router.post('/sync/orders', async (req, res) => {
  try {
    const data = await pdd.getOrderList({ order_status: 1 });
    res.json({ code: 0, data, message: 'ok' });
  } catch (err) {
    res.json({ code: 1, message: err.message });
  }
});

// 手动同步商品
router.post('/sync/goods', async (req, res) => {
  try {
    const data = await pdd.getGoodsList();
    res.json({ code: 0, data, message: 'ok' });
  } catch (err) {
    res.json({ code: 1, message: err.message });
  }
});

// 手动生成日报
router.post('/report/daily', async (req, res) => {
  try {
    await feishu.sendMessage('📊 手动触发日报生成');
    res.json({ code: 0, message: '日报已触发' });
  } catch (err) {
    res.json({ code: 1, message: err.message });
  }
});

module.exports = router;
