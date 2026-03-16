const axios = require('axios');
const crypto = require('crypto');
const config = require('../config');

function sign(params) {
  const sorted = Object.keys(params).sort().map(k => `${k}${params[k]}`).join('');
  const str = config.pdd.clientSecret + sorted + config.pdd.clientSecret;
  return crypto.createHash('md5').update(str).digest('hex').toUpperCase();
}

async function call(type, params = {}) {
  const base = {
    type,
    client_id: config.pdd.clientId,
    access_token: config.pdd.accessToken,
    timestamp: Math.floor(Date.now() / 1000),
    data_type: 'JSON',
    version: 'V1',
    ...params,
  };
  base.sign = sign(base);
  const res = await axios.post(config.pdd.apiUrl, null, { params: base });
  return res.data;
}

// 商品列表
const getGoodsList = (p = {}) => call('pdd.goods.list.get', p);
// 更新商品
const updateGoods = (goodsId, data) => call('pdd.goods.detail.update', { goods_id: goodsId, ...data });
// 上下架
const updateGoodsStatus = (goodsId, status) => call('pdd.goods.status.update', { goods_id: goodsId, is_onsale: status });
// 订单列表
const getOrderList = (p = {}) => call('pdd.order.list.get', p);
// 发货（圆通）
const shipOrder = (orderSn, trackingNumber) => call('pdd.logistics.online.send', {
  order_sn: orderSn,
  logistics_id: 4, // 圆通快递
  tracking_number: trackingNumber,
});
// 订单详情
const getOrderDetail = (orderSn) => call('pdd.order.information.get', { order_sn: orderSn });

module.exports = { getGoodsList, updateGoods, updateGoodsStatus, getOrderList, shipOrder, getOrderDetail };
