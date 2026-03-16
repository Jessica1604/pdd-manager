'use strict';

/**
 * 订单服务：同步、发货、查询
 */

const pdd = require('../api/pdd-client');
const db = require('../utils/db');
const feishu = require('../utils/feishu');
const logger = require('../utils/logger');

/**
 * 同步最新订单到本地数据库
 * 拉取待发货订单，新订单存库并发飞书通知
 */
async function syncOrders() {
  logger.info('[订单同步] 开始...');
  try {
    const res = await pdd.getOrderList({
      orderStatus: 1, // 待发货
      startTime: Math.floor(Date.now() / 1000) - 86400, // 最近 24h
    });

    const orders = res.order_list || [];
    let newCount = 0;

    const insert = db.prepare(`
      INSERT OR IGNORE INTO orders
        (order_sn, buyer_name, buyer_phone, buyer_address, goods_info, total_amount, status)
      VALUES
        (@order_sn, @buyer_name, @buyer_phone, @buyer_address, @goods_info, @total_amount, @status)
    `);

    for (const o of orders) {
      const row = {
        order_sn: o.order_sn,
        buyer_name: o.receiver_name || '',
        buyer_phone: o.receiver_phone || '',
        buyer_address: `${o.province}${o.city}${o.town}${o.address}`,
        goods_info: JSON.stringify(o.order_items || []),
        total_amount: (o.order_amount || 0) / 100,
        status: 'pending',
      };
      const result = insert.run(row);
      if (result.changes > 0) {
        newCount++;
        await notifyNewOrder(row);
      }
    }

    logger.info(`[订单同步] 完成，新增 ${newCount} 条`);
    return { total: orders.length, newCount };
  } catch (err) {
    logger.error(`[订单同步] 失败: ${err.message}`);
    throw err;
  }
}

/**
 * 发货（圆通快递）
 * @param {string} orderSn
 * @param {string} trackingNumber
 */
async function shipOrder(orderSn, trackingNumber) {
  await pdd.shipOrder(orderSn, trackingNumber);

  db.prepare(`
    UPDATE orders SET status='shipped', tracking_number=?, updated_at=CURRENT_TIMESTAMP
    WHERE order_sn=?
  `).run(trackingNumber, orderSn);

  logger.info(`[发货] ${orderSn} → 圆通 ${trackingNumber}`);
}

/**
 * 批量发货
 * @param {Array<{orderSn, trackingNumber}>} list
 */
async function batchShip(list) {
  const results = await pdd.batchShipOrders(list);

  const update = db.prepare(`
    UPDATE orders SET status='shipped', tracking_number=?, updated_at=CURRENT_TIMESTAMP
    WHERE order_sn=?
  `);
  for (const r of results) {
    if (r.success) update.run(
      list.find(i => i.orderSn === r.orderSn)?.trackingNumber,
      r.orderSn
    );
  }
  return results;
}

/**
 * 查询本地订单列表
 */
function getLocalOrders({ status, limit = 50, offset = 0 } = {}) {
  if (status) {
    return db.prepare('SELECT * FROM orders WHERE status=? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(status, limit, offset);
  }
  return db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT ? OFFSET ?')
    .all(limit, offset);
}

// ─── 飞书通知 ─────────────────────────────────────────────────────────────────

async function notifyNewOrder(order) {
  const text = [
    '📦 新订单提醒',
    `订单号：${order.order_sn}`,
    `金额：¥${order.total_amount}`,
    `买家：${order.buyer_name}`,
    `地址：${order.buyer_address}`,
  ].join('\n');
  await feishu.sendMessage(text);
}

module.exports = { syncOrders, shipOrder, batchShip, getLocalOrders };
