'use strict';

const { forShop } = require('../api/pdd-client');
const db = require('../utils/db');
const feishu = require('../utils/feishu');
const logger = require('../utils/logger');

/** 同步指定店铺的待发货订单 */
async function syncOrders(shopId) {
  logger.info(`[订单同步] 店铺 ${shopId} 开始...`);
  const api = forShop(shopId);
  const res = await api.getOrderList({
    order_status: 1,
    start_time: Math.floor(Date.now() / 1000) - 86400,
  });
  const orders = (res.order_list_get_response || {}).order_list || [];
  let newCount = 0;

  const insert = db.prepare(`
    INSERT OR IGNORE INTO orders
      (shop_id, order_sn, buyer_name, buyer_phone, buyer_address, goods_info, total_amount, status)
    VALUES (@shop_id,@order_sn,@buyer_name,@buyer_phone,@buyer_address,@goods_info,@total_amount,@status)
  `);

  for (const o of orders) {
    const row = {
      shop_id: shopId,
      order_sn: o.order_sn,
      buyer_name: o.receiver_name || '',
      buyer_phone: o.receiver_phone || '',
      buyer_address: `${o.province || ''}${o.city || ''}${o.town || ''}${o.address || ''}`,
      goods_info: JSON.stringify(o.order_items || []),
      total_amount: (o.order_amount || 0) / 100,
      status: 'pending',
    };
    if (insert.run(row).changes > 0) {
      newCount++;
      await notifyNewOrder(shopId, row);
    }
  }
  logger.info(`[订单同步] 店铺 ${shopId} 完成，新增 ${newCount} 条`);
  return { total: orders.length, newCount };
}

/** 发货（圆通） */
async function shipOrder(shopId, orderSn, trackingNumber) {
  await forShop(shopId).shipOrder(orderSn, trackingNumber);
  db.prepare(`UPDATE orders SET status='shipped', tracking_number=?, updated_at=CURRENT_TIMESTAMP
    WHERE shop_id=? AND order_sn=?`).run(trackingNumber, shopId, orderSn);
  logger.info(`[发货] 店铺${shopId} ${orderSn} → 圆通 ${trackingNumber}`);
}

/** 批量发货 */
async function batchShip(shopId, list) {
  const results = await forShop(shopId).batchShipOrders(list);
  const update = db.prepare(`UPDATE orders SET status='shipped', tracking_number=?, updated_at=CURRENT_TIMESTAMP
    WHERE shop_id=? AND order_sn=?`);
  for (const r of results) {
    if (r.success) {
      const item = list.find(i => i.orderSn === r.orderSn);
      if (item) update.run(item.trackingNumber, shopId, r.orderSn);
    }
  }
  return results;
}

/** 查询本地订单 */
function getLocalOrders(shopId, { status, limit = 50, offset = 0 } = {}) {
  if (status) {
    return db.prepare('SELECT * FROM orders WHERE shop_id=? AND status=? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(shopId, status, limit, offset);
  }
  return db.prepare('SELECT * FROM orders WHERE shop_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?')
    .all(shopId, limit, offset);
}

async function notifyNewOrder(shopId, order) {
  const db = require('./shop.service');
  const shopName = `店铺 #${shopId}`;
  await feishu.notifyNewOrder(shopName, order);
}

module.exports = { syncOrders, shipOrder, batchShip, getLocalOrders };
