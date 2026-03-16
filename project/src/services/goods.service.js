'use strict';

const { forShop } = require('../api/pdd-client');
const db = require('../utils/db');
const feishu = require('../utils/feishu');
const logger = require('../utils/logger');
const config = require('../config');

/** 同步指定店铺商品 */
async function syncGoods(shopId) {
  logger.info(`[商品同步] 店铺 ${shopId} 开始...`);
  const res = await forShop(shopId).getGoodsList({ page_size: 100 });
  const goods = (res.goods_list_get_response || {}).goods_list || [];

  const upsert = db.prepare(`
    INSERT INTO goods (shop_id, goods_id, goods_name, price, stock, status)
    VALUES (@shop_id,@goods_id,@goods_name,@price,@stock,@status)
    ON CONFLICT(shop_id, goods_id) DO UPDATE SET
      goods_name=excluded.goods_name, price=excluded.price,
      stock=excluded.stock, status=excluded.status,
      updated_at=CURRENT_TIMESTAMP
  `);
  for (const g of goods) {
    upsert.run({
      shop_id: shopId,
      goods_id: String(g.goods_id),
      goods_name: g.goods_name,
      price: (g.min_group_price || 0) / 100,
      stock: g.quantity || 0,
      status: g.is_onsale ? 'on' : 'off',
    });
  }
  logger.info(`[商品同步] 店铺 ${shopId} 完成，共 ${goods.length} 件`);
  return goods.length;
}

/** 检查指定店铺库存预警 */
async function checkStockWarning(shopId) {
  const threshold = config.stock.warningThreshold;
  const lowStock = db.prepare(
    "SELECT * FROM goods WHERE shop_id=? AND stock<=? AND status='on'"
  ).all(shopId, threshold);

  if (!lowStock.length) return [];
  await feishu.notifyStockWarning(`店铺 #${shopId}`, lowStock);
  return lowStock;
}

/** 查询本地商品 */
function getLocalGoods(shopId, { status, limit = 100, offset = 0 } = {}) {
  if (status) {
    return db.prepare("SELECT * FROM goods WHERE shop_id=? AND status=? ORDER BY updated_at DESC LIMIT ? OFFSET ?")
      .all(shopId, status, limit, offset);
  }
  return db.prepare('SELECT * FROM goods WHERE shop_id=? ORDER BY updated_at DESC LIMIT ? OFFSET ?')
    .all(shopId, limit, offset);
}

/** 更新商品 */
async function updateGoods(shopId, goodsId, data) {
  await forShop(shopId).updateGoods(goodsId, data);
  const fields = [], values = [];
  if (data.goodsName) { fields.push('goods_name=?'); values.push(data.goodsName); }
  if (data.price)     { fields.push('price=?');      values.push(data.price); }
  if (data.stock)     { fields.push('stock=?');      values.push(data.stock); }
  if (fields.length) {
    fields.push('updated_at=CURRENT_TIMESTAMP');
    values.push(shopId, String(goodsId));
    db.prepare(`UPDATE goods SET ${fields.join(',')} WHERE shop_id=? AND goods_id=?`).run(...values);
  }
}

/** 批量上下架 */
async function batchUpdateStatus(shopId, goodsIds, onSale) {
  const results = await forShop(shopId).batchUpdateGoodsStatus(goodsIds, onSale);
  const status = onSale ? 'on' : 'off';
  const update = db.prepare("UPDATE goods SET status=?, updated_at=CURRENT_TIMESTAMP WHERE shop_id=? AND goods_id=?");
  for (const r of results) {
    if (r.success) update.run(status, shopId, String(r.goodsId));
  }
  return results;
}

module.exports = { syncGoods, checkStockWarning, getLocalGoods, updateGoods, batchUpdateStatus };
