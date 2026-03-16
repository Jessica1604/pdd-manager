'use strict';

/**
 * 飞书通知工具（完整版）
 * 支持：文本消息、富文本卡片、订单通知、库存预警、日报、系统告警
 */

const axios = require('axios');
const config = require('../config');
const logger = require('./logger');

async function post(payload) {
  if (!config.feishu.webhookUrl) return;
  try {
    const res = await axios.post(config.feishu.webhookUrl, payload, { timeout: 5000 });
    if (res.data.code !== 0) logger.warn(`[飞书] 发送失败: ${res.data.msg}`);
  } catch (err) {
    logger.error(`[飞书] 请求异常: ${err.message}`);
  }
}

/** 纯文本消息 */
async function sendMessage(text) {
  return post({ msg_type: 'text', content: { text } });
}

/** 富文本卡片 */
async function sendCard(title, lines = [], color = 'blue') {
  const content = lines.join('\n');
  return post({
    msg_type: 'interactive',
    card: {
      header: {
        title: { tag: 'plain_text', content: title },
        template: color,
      },
      elements: [{ tag: 'div', text: { tag: 'lark_md', content } }],
    },
  });
}

// ─── 业务通知模板 ─────────────────────────────────────────────────────────────

/** 新订单通知 */
async function notifyNewOrder(shopName, order) {
  return sendCard(
    `📦 新订单 · ${shopName}`,
    [
      `**订单号：** ${order.order_sn}`,
      `**金额：** ¥${order.total_amount}`,
      `**买家：** ${order.buyer_name}`,
      `**地址：** ${order.buyer_address}`,
      `**时间：** ${new Date().toLocaleString('zh-CN')}`,
    ],
    'green'
  );
}

/** 退款申请通知 */
async function notifyRefund(shopName, order) {
  return sendCard(
    `🔴 退款申请 · ${shopName}`,
    [
      `**订单号：** ${order.order_sn}`,
      `**金额：** ¥${order.total_amount}`,
      `**买家：** ${order.buyer_name}`,
      `**原因：** ${order.refund_reason || '未填写'}`,
    ],
    'red'
  );
}

/** 发货失败通知 */
async function notifyShipFail(shopName, orderSn, reason) {
  return sendCard(
    `⚠️ 发货失败 · ${shopName}`,
    [`**订单号：** ${orderSn}`, `**原因：** ${reason}`],
    'orange'
  );
}

/** 库存预警通知 */
async function notifyStockWarning(shopName, items) {
  const lines = items.map(g => `- **${g.goods_name}**：剩余 ${g.stock} 件`);
  return sendCard(
    `⚠️ 库存预警 · ${shopName}`,
    [`以下商品库存不足，请及时补货：`, ...lines],
    'orange'
  );
}

/** 每日销售日报 */
async function sendDailyReport(shopName, data) {
  const { date, totalAmount, orderCount, topGoods = [], aiSuggestion = '' } = data;
  const topLines = topGoods.slice(0, 5).map((g, i) => `${i + 1}. ${g.name} — ${g.count} 单`);
  return sendCard(
    `📊 每日销售日报 · ${shopName} · ${date}`,
    [
      `💰 **销售额：** ¥${totalAmount.toFixed(2)}`,
      `📦 **订单量：** ${orderCount} 单`,
      '',
      '🔥 **热销商品 TOP 5：**',
      ...topLines,
      '',
      aiSuggestion ? `🤖 **AI 建议：**\n${aiSuggestion}` : '',
    ].filter(l => l !== undefined),
    'blue'
  );
}

/** 系统异常告警 */
async function notifyAlert(title, detail) {
  return sendCard(`🚨 系统告警：${title}`, [detail], 'red');
}

module.exports = {
  sendMessage,
  sendCard,
  notifyNewOrder,
  notifyRefund,
  notifyShipFail,
  notifyStockWarning,
  sendDailyReport,
  notifyAlert,
};
