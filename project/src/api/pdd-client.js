'use strict';

/**
 * 拼多多开放平台 API 封装（多店铺版）
 * 通过 shopId 动态加载对应店铺的 client_id / secret / access_token
 */

const axios = require('axios');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../utils/logger');
const db = require('../utils/db');

// 每个店铺独立的限流队列
const queues = {};
const RATE_LIMIT_MS = 120;

// ─── 店铺凭证 ─────────────────────────────────────────────────────────────────

/**
 * 获取店铺凭证（优先数据库，fallback 到 .env 默认值）
 */
function getShopCredentials(shopId) {
  if (shopId) {
    const shop = db.prepare('SELECT * FROM shops WHERE id=? AND status="active"').get(shopId);
    if (!shop) throw new Error(`店铺 ${shopId} 不存在或已禁用`);
    return { clientId: shop.client_id, clientSecret: shop.client_secret, accessToken: shop.access_token };
  }
  // 未指定 shopId 时使用 .env 默认配置（兼容单店铺模式）
  return { clientId: config.pdd.clientId, clientSecret: config.pdd.clientSecret, accessToken: config.pdd.accessToken };
}

// ─── 签名 ─────────────────────────────────────────────────────────────────────

function sign(params, clientSecret) {
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
  const sorted = Object.keys(filtered).sort().map(k => `${k}${filtered[k]}`).join('');
  const raw = `${clientSecret}${sorted}${clientSecret}`;
  return crypto.createHash('md5').update(raw).digest('hex').toUpperCase();
}

// ─── 核心请求 ─────────────────────────────────────────────────────────────────

async function call(type, params = {}, shopId = null, retry = 3) {
  const { clientId, clientSecret, accessToken } = getShopCredentials(shopId);

  // 每个店铺独立限流队列
  const qKey = shopId || 'default';
  if (!queues[qKey]) queues[qKey] = Promise.resolve();
  queues[qKey] = queues[qKey].then(() => new Promise(r => setTimeout(r, RATE_LIMIT_MS)));
  await queues[qKey];

  const base = {
    type,
    client_id: clientId,
    access_token: accessToken,
    timestamp: Math.floor(Date.now() / 1000),
    data_type: 'JSON',
    version: 'V1',
    ...params,
  };
  base.sign = sign(base, clientSecret);

  try {
    const res = await axios.post(config.pdd.apiUrl, null, { params: base, timeout: 10000 });
    const data = res.data;

    if (data.error_response) {
      const { error_code, error_msg, sub_msg } = data.error_response;
      const msg = `[PDD][shop=${qKey}] ${type} 失败 code=${error_code} ${error_msg} ${sub_msg || ''}`;
      if (error_code === 10038 && retry > 0) {
        logger.warn(`${msg}，限流重试...`);
        await new Promise(r => setTimeout(r, 1000));
        return call(type, params, shopId, retry - 1);
      }
      logger.error(msg);
      throw Object.assign(new Error(msg), { code: error_code });
    }
    return data;
  } catch (err) {
    if (err.code && err.code !== 'ECONNABORTED') throw err;
    if (retry > 0) {
      logger.warn(`[PDD][shop=${qKey}] ${type} 网络错误重试: ${err.message}`);
      await new Promise(r => setTimeout(r, 1500));
      return call(type, params, shopId, retry - 1);
    }
    throw err;
  }
}

// ─── 工厂函数：为指定店铺创建 API 实例 ───────────────────────────────────────

/**
 * 获取指定店铺的 API 客户端
 * 用法：const api = pddClient.forShop(shopId);  await api.getOrderList();
 */
function forShop(shopId) {
  const c = (type, params) => call(type, params, shopId);
  return {
    shopId,
    // 商品
    getGoodsList:           (p = {}) => c('pdd.goods.list.get', { page: 1, page_size: 100, ...p }),
    getGoodsDetail:         (goodsId) => c('pdd.goods.detail.get', { goods_id: goodsId }),
    updateGoods:            (goodsId, data) => c('pdd.goods.detail.update', { goods_id: goodsId, ...data }),
    updateSkuStock:         (goodsId, skuId, qty) => c('pdd.goods.sku.price.update', { goods_id: goodsId, sku_id: skuId, quantity: qty }),
    updateGoodsStatus:      (goodsId, onSale) => c('pdd.goods.status.update', { goods_id: goodsId, is_onsale: onSale ? 1 : 0 }),
    batchUpdateGoodsStatus: async (goodsIds, onSale) => {
      const results = [];
      for (const goodsId of goodsIds) {
        try { await c('pdd.goods.status.update', { goods_id: goodsId, is_onsale: onSale ? 1 : 0 }); results.push({ goodsId, success: true }); }
        catch (e) { results.push({ goodsId, success: false, error: e.message }); }
      }
      return results;
    },
    // 订单
    getOrderList:    (p = {}) => c('pdd.order.list.get', { page: 1, page_size: 50, ...p }),
    getOrderDetail:  (orderSn) => c('pdd.order.information.get', { order_sn: orderSn }),
    shipOrder:       (orderSn, trackingNumber) => c('pdd.logistics.online.send', { order_sn: orderSn, logistics_id: 4, tracking_number: trackingNumber, logistics_name: '圆通快递' }),
    batchShipOrders: async (list) => {
      const results = [];
      for (const { orderSn, trackingNumber } of list) {
        try { await c('pdd.logistics.online.send', { order_sn: orderSn, logistics_id: 4, tracking_number: trackingNumber }); results.push({ orderSn, success: true }); }
        catch (e) { results.push({ orderSn, success: false, error: e.message }); }
      }
      return results;
    },
    addOrderRemark:    (orderSn, remark) => c('pdd.order.remark.update', { order_sn: orderSn, remark }),
    // 物流
    getLogisticsTrack: (orderSn) => c('pdd.logistics.track.get', { order_sn: orderSn }),
    // 客服
    getMessageList:    (p = {}) => c('pdd.im.conversation.list.get', { page: 1, page_size: 20, ...p }),
    sendMessage:       (conversationId, content) => c('pdd.im.message.send', { conversation_id: conversationId, msg_type: 1, content }),
  };
}

module.exports = { forShop, call };
