'use strict';

/**
 * 店铺管理服务：增删改查多个拼多多账号
 */

const db = require('../utils/db');
const { forShop } = require('../api/pdd-client');
const logger = require('../utils/logger');

/** 获取所有店铺列表（不返回敏感凭证） */
function listShops() {
  return db.prepare(`
    SELECT id, name, client_id, status, created_at, updated_at FROM shops ORDER BY id
  `).all();
}

/** 获取单个店铺（含凭证，内部使用） */
function getShop(shopId) {
  return db.prepare('SELECT * FROM shops WHERE id=?').get(shopId);
}

/** 添加店铺 */
function addShop({ name, clientId, clientSecret, accessToken }) {
  if (!name || !clientId || !clientSecret || !accessToken) {
    throw new Error('name / clientId / clientSecret / accessToken 均为必填');
  }
  const result = db.prepare(`
    INSERT INTO shops (name, client_id, client_secret, access_token)
    VALUES (?, ?, ?, ?)
  `).run(name, clientId, clientSecret, accessToken);
  logger.info(`[店铺] 新增店铺: ${name} (id=${result.lastInsertRowid})`);
  return result.lastInsertRowid;
}

/** 更新店铺信息 */
function updateShop(shopId, { name, clientId, clientSecret, accessToken, status }) {
  const fields = [], values = [];
  if (name)         { fields.push('name=?');          values.push(name); }
  if (clientId)     { fields.push('client_id=?');     values.push(clientId); }
  if (clientSecret) { fields.push('client_secret=?'); values.push(clientSecret); }
  if (accessToken)  { fields.push('access_token=?');  values.push(accessToken); }
  if (status)       { fields.push('status=?');        values.push(status); }
  if (!fields.length) throw new Error('没有可更新的字段');
  fields.push('updated_at=CURRENT_TIMESTAMP');
  values.push(shopId);
  db.prepare(`UPDATE shops SET ${fields.join(',')} WHERE id=?`).run(...values);
  logger.info(`[店铺] 更新店铺 id=${shopId}`);
}

/** 删除店铺（软删除，改为 disabled） */
function disableShop(shopId) {
  db.prepare("UPDATE shops SET status='disabled', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(shopId);
  logger.info(`[店铺] 禁用店铺 id=${shopId}`);
}

/**
 * 验证店铺凭证是否有效（调用拼多多 pdd.time.get 接口）
 */
async function verifyShop(shopId) {
  try {
    const api = forShop(shopId);
    await api.getGoodsList({ page: 1, page_size: 1 });
    return { valid: true };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

module.exports = { listShops, getShop, addShop, updateShop, disableShop, verifyShop };
