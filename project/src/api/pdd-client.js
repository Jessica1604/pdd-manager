'use strict';

/**
 * 拼多多开放平台 API 封装
 * 文档：https://open.pinduoduo.com/application/document/browse
 */

const axios = require('axios');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../utils/logger');

// 请求队列：避免触发拼多多限流（同一 appKey 每秒最多 10 次）
let requestQueue = Promise.resolve();
const RATE_LIMIT_MS = 120; // 每次请求间隔 120ms

// ─── 签名 ────────────────────────────────────────────────────────────────────

/**
 * 生成拼多多 API 签名
 * 规则：clientSecret + 所有参数键值对按字母排序拼接 + clientSecret，MD5 大写
 */
function sign(params) {
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
  const sorted = Object.keys(filtered)
    .sort()
    .map(k => `${k}${filtered[k]}`)
    .join('');
  const raw = `${config.pdd.clientSecret}${sorted}${config.pdd.clientSecret}`;
  return crypto.createHash('md5').update(raw).digest('hex').toUpperCase();
}

// ─── 核心请求 ─────────────────────────────────────────────────────────────────

/**
 * 发起拼多多 API 请求（带限流队列 + 自动重试）
 * @param {string} type   API 类型，如 pdd.goods.list.get
 * @param {object} params 业务参数
 * @param {number} retry  剩余重试次数
 */
async function call(type, params = {}, retry = 3) {
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

  // 串行队列，保证请求间隔
  requestQueue = requestQueue.then(() => new Promise(r => setTimeout(r, RATE_LIMIT_MS)));

  await requestQueue;

  try {
    const res = await axios.post(config.pdd.apiUrl, null, {
      params: base,
      timeout: 10000,
    });

    const data = res.data;

    // 拼多多错误码处理
    if (data.error_response) {
      const { error_code, error_msg, sub_msg } = data.error_response;
      const msg = `[PDD API] ${type} 失败 code=${error_code} ${error_msg} ${sub_msg || ''}`;

      // 限流错误自动重试
      if (error_code === 10038 && retry > 0) {
        logger.warn(`${msg}，${retry} 次后重试...`);
        await new Promise(r => setTimeout(r, 1000));
        return call(type, params, retry - 1);
      }

      logger.error(msg);
      throw Object.assign(new Error(msg), { code: error_code });
    }

    return data;
  } catch (err) {
    if (err.code && err.code !== 'ECONNABORTED') throw err; // 业务错误直接抛出

    // 网络超时重试
    if (retry > 0) {
      logger.warn(`[PDD API] ${type} 网络错误，${retry} 次后重试: ${err.message}`);
      await new Promise(r => setTimeout(r, 1500));
      return call(type, params, retry - 1);
    }
    throw err;
  }
}

// ─── 商品管理 ─────────────────────────────────────────────────────────────────

/**
 * 获取商品列表
 * @param {object} opts
 * @param {number} opts.page        页码，从 1 开始
 * @param {number} opts.pageSize    每页数量，最大 100
 * @param {number} opts.isOnSale    上架状态：1=上架 0=下架
 */
async function getGoodsList({ page = 1, pageSize = 100, isOnSale } = {}) {
  const params = { page, page_size: pageSize };
  if (isOnSale !== undefined) params.is_onsale = isOnSale;
  const res = await call('pdd.goods.list.get', params);
  return res.goods_list_get_response || {};
}

/**
 * 获取商品详情
 * @param {string|number} goodsId
 */
async function getGoodsDetail(goodsId) {
  const res = await call('pdd.goods.detail.get', { goods_id: goodsId });
  return res.goods_detail_response || {};
}

/**
 * 更新商品信息（标题/价格/库存/描述）
 * @param {string|number} goodsId
 * @param {object} data  { goodsName, price, stock, goodsDesc }
 */
async function updateGoods(goodsId, { goodsName, price, stock, goodsDesc } = {}) {
  const params = { goods_id: goodsId };
  if (goodsName !== undefined) params.goods_name = goodsName;
  if (price !== undefined) params.min_group_price = Math.round(price * 100); // 单位：分
  if (stock !== undefined) params.quantity = stock;
  if (goodsDesc !== undefined) params.goods_desc = goodsDesc;
  return call('pdd.goods.detail.update', params);
}

/**
 * 更新 SKU 库存
 * @param {string|number} goodsId
 * @param {string|number} skuId
 * @param {number}        quantity
 */
async function updateSkuStock(goodsId, skuId, quantity) {
  return call('pdd.goods.sku.price.update', {
    goods_id: goodsId,
    sku_id: skuId,
    quantity,
  });
}

/**
 * 商品上下架
 * @param {string|number} goodsId
 * @param {boolean}       onSale  true=上架 false=下架
 */
async function updateGoodsStatus(goodsId, onSale) {
  return call('pdd.goods.status.update', {
    goods_id: goodsId,
    is_onsale: onSale ? 1 : 0,
  });
}

/**
 * 批量上下架
 * @param {Array<string|number>} goodsIds
 * @param {boolean}              onSale
 */
async function batchUpdateGoodsStatus(goodsIds, onSale) {
  const results = [];
  for (const goodsId of goodsIds) {
    try {
      const r = await updateGoodsStatus(goodsId, onSale);
      results.push({ goodsId, success: true, data: r });
    } catch (err) {
      results.push({ goodsId, success: false, error: err.message });
    }
  }
  return results;
}

// ─── 订单管理 ─────────────────────────────────────────────────────────────────

/**
 * 获取订单列表
 * @param {object} opts
 * @param {number} opts.orderStatus  订单状态：1=待发货 2=已发货 3=已完成 4=退款中
 * @param {number} opts.startTime    开始时间戳（秒）
 * @param {number} opts.endTime      结束时间戳（秒）
 * @param {number} opts.page
 * @param {number} opts.pageSize     最大 50
 */
async function getOrderList({ orderStatus, startTime, endTime, page = 1, pageSize = 50 } = {}) {
  const params = { page, page_size: pageSize };
  if (orderStatus !== undefined) params.order_status = orderStatus;
  if (startTime) params.start_time = startTime;
  if (endTime) params.end_time = endTime;
  const res = await call('pdd.order.list.get', params);
  return res.order_list_get_response || {};
}

/**
 * 获取订单详情
 * @param {string} orderSn
 */
async function getOrderDetail(orderSn) {
  const res = await call('pdd.order.information.get', { order_sn: orderSn });
  return res.order_info_get_response || {};
}

/**
 * 发货（仅支持圆通快递）
 * @param {string} orderSn
 * @param {string} trackingNumber  圆通快递单号
 */
async function shipOrder(orderSn, trackingNumber) {
  return call('pdd.logistics.online.send', {
    order_sn: orderSn,
    logistics_id: 4,          // 圆通快递固定 ID
    tracking_number: trackingNumber,
    logistics_name: '圆通快递',
  });
}

/**
 * 批量发货
 * @param {Array<{orderSn, trackingNumber}>} list
 * @returns {Array<{orderSn, success, error?}>}
 */
async function batchShipOrders(list) {
  const results = [];
  for (const { orderSn, trackingNumber } of list) {
    try {
      await shipOrder(orderSn, trackingNumber);
      results.push({ orderSn, success: true });
      logger.info(`[发货] ${orderSn} 圆通 ${trackingNumber} ✓`);
    } catch (err) {
      results.push({ orderSn, success: false, error: err.message });
      logger.error(`[发货] ${orderSn} 失败: ${err.message}`);
    }
  }
  return results;
}

/**
 * 添加订单备注
 * @param {string} orderSn
 * @param {string} remark
 */
async function addOrderRemark(orderSn, remark) {
  return call('pdd.order.remark.update', { order_sn: orderSn, remark });
}

// ─── 物流查询 ─────────────────────────────────────────────────────────────────

/**
 * 查询物流轨迹
 * @param {string} orderSn
 */
async function getLogisticsTrack(orderSn) {
  const res = await call('pdd.logistics.track.get', { order_sn: orderSn });
  return res.logistics_track_response || {};
}

// ─── 客服消息 ─────────────────────────────────────────────────────────────────

/**
 * 获取待回复消息列表
 */
async function getMessageList({ page = 1, pageSize = 20 } = {}) {
  const res = await call('pdd.im.conversation.list.get', { page, page_size: pageSize });
  return res.im_conversation_list_response || {};
}

/**
 * 发送客服消息
 * @param {string} conversationId
 * @param {string} content
 */
async function sendMessage(conversationId, content) {
  return call('pdd.im.message.send', {
    conversation_id: conversationId,
    msg_type: 1, // 文本
    content,
  });
}

// ─── 导出 ─────────────────────────────────────────────────────────────────────

module.exports = {
  // 商品
  getGoodsList,
  getGoodsDetail,
  updateGoods,
  updateSkuStock,
  updateGoodsStatus,
  batchUpdateGoodsStatus,
  // 订单
  getOrderList,
  getOrderDetail,
  shipOrder,
  batchShipOrders,
  addOrderRemark,
  // 物流
  getLogisticsTrack,
  // 客服
  getMessageList,
  sendMessage,
};
