'use strict';

/**
 * 轻量内存缓存
 * 用于缓存 Dashboard 汇总、热销商品等热点数据，减少重复 DB 查询
 */

const store = new Map();

/**
 * 获取缓存
 * @param {string} key
 * @returns {any|null} 未命中或已过期返回 null
 */
function get(key) {
  const item = store.get(key);
  if (!item) return null;
  if (Date.now() > item.expireAt) {
    store.delete(key);
    return null;
  }
  return item.value;
}

/**
 * 设置缓存
 * @param {string} key
 * @param {any} value
 * @param {number} ttlMs 过期时间（毫秒），默认 60 秒
 */
function set(key, value, ttlMs = 60_000) {
  store.set(key, { value, expireAt: Date.now() + ttlMs });
}

/**
 * 删除缓存（数据变更时主动失效）
 * @param {string|RegExp} keyOrPattern
 */
function del(keyOrPattern) {
  if (typeof keyOrPattern === 'string') {
    store.delete(keyOrPattern);
  } else {
    for (const key of store.keys()) {
      if (keyOrPattern.test(key)) store.delete(key);
    }
  }
}

/**
 * 缓存穿透包装：有缓存直接返回，无缓存执行 fn 并缓存结果
 * @param {string} key
 * @param {Function} fn  async () => value
 * @param {number} ttlMs
 */
async function wrap(key, fn, ttlMs = 60_000) {
  const cached = get(key);
  if (cached !== null) return cached;
  const value = await fn();
  set(key, value, ttlMs);
  return value;
}

// 每 5 分钟清理过期 key，防止内存泄漏
setInterval(() => {
  const now = Date.now();
  for (const [key, item] of store.entries()) {
    if (now > item.expireAt) store.delete(key);
  }
}, 5 * 60_000);

module.exports = { get, set, del, wrap };
