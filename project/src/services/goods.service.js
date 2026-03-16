'use strict';

/**
 * 商品服务：同步、编辑、上下架、库存管理
 */

const pdd = require('../api/pdd-client');
const db = require('../utils/db');
const feishu = require('../utils/feishu');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * 同步商品列表到本地数据库
 */
async function syncGoods() {
  logger.info('[商品同步] 开始...');
  try {
    const res = await pdd.getGoodsList({ pageSize: 100 });
    const goods = res.goods_list || [];

    const upsert = db.prepare(`
      INSERT INTO goods (goods_id, goods_name, price, stock, status)
      VALUES (@goods_id, @goods_name, @price, @stock, @status)
      ON CONFLICT(goods_id) DO UPDATE SET
        goods_name=excluded.goods_name,
        price=excluded.price,
        stock=excluded.stock,
        status=excluded.status,
        updated_at=CURRENT_TIMESTAMP
    `);

    for (const g of goods) {
      upsert.run({
        goods_id: String(g.goods_id),
        goods_name: g.goods_name,
        price: (g.min_group_price || 0) / 100,
        stock: g.quantity || 0,
        status: g.is_onsale ? 'on' : 'off',
      });
    }

    logger.info(`[商品同步] 完成，共 ${goods.length} 件`);
    return goods.length;
  } catch (err) {
    logger.error(`[商品同步] 失败: ${err.message}`);
    throw err;
  }
}

/**
 * 检查库存预警，低于阈值时发飞书通知
 */
async function checkStockWarning() {
  const threshold = config.stock.warningThreshold;
  const lowStock = db.prepare(
    'SELECT * FROM goods WHERE stock <= ? AND status="on"'
  ).all(threshold);

  if (lowStock.length === 0) return;

  const lines = lowStock.map(g => `- ${g.goods_name}（库存：${g.stock} 件）`).join('\n');
  const msg = `⚠️ 库存预警\n以下商品库存不足 ${threshold} 件：\n${lines}`;
  await feishu.sendMessage(msg);
  logger.warn(`[库存预警] ${lowStock.length} 件商品库存不足`);

  return lowStock;
}

/**
 * 查询本地商品列表
 */
function getLocalGoods({ status, limit = 100, offset = 0 } = {}) {
  if (status) {
    return db.prepare('SELECT * FROM goods WHERE status=? ORDER BY updated_at DESC LIMIT ? OFFSET ?')
      .all(status, limit, offset);
  }
  return db.prepare('SELECT * FROM goods ORDER BY updated_at DESC LIMIT ? OFFSET ?')
    .all(limit, offset);
}

/**
 * 更新商品（同步到拼多多 + 本地数据库）
 */
async function updateGoods(goodsId, data) {
  await pdd.updateGoods(goodsId, data);

  const fields = [];
  const values = [];
  if (data.goodsName) { fields.push('goods_name=?'); values.push(data.goodsName); }
  if (data.price)     { fields.push('price=?');      values.push(data.price); }
  if (data.stock)     { fields.push('stock=?');      values.push(data.stock); }
  if (fields.length) {
    fields.push('updated_at=CURRENT_TIMESTAMP');
    values.push(String(goodsId));
    db.prepare(`UPDATE goods SET ${fields.join(',')} WHERE goods_id=?`).run(...values);
  }
  logger.info(`[商品更新] ${goodsId}`);
}

/**
 * 批量上下架
 */
async function batchUpdateStatus(goodsIds, onSale) {
  const results = await pdd.batchUpdateGoodsStatus(goodsIds, onSale);
  const status = onSale ? 'on' : 'off';
  const update = db.prepare('UPDATE goods SET status=?, updated_at=CURRENT_TIMESTAMP WHERE goods_id=?');
  for (const r of results) {
    if (r.success) update.run(status, String(r.goodsId));
  }
  return results;
}

module.exports = { syncGoods, checkStockWarning, getLocalGoods, updateGoods, batchUpdateStatus };
