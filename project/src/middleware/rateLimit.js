'use strict';

/**
 * 请求频率限制中间件（基于内存，无需 Redis）
 * 防止 API 滥用，保护后端服务
 */

const logger = require('../utils/logger');

// 存储每个 IP 的请求记录
const ipStore = new Map();

/**
 * 创建限流中间件
 * @param {object} options
 * @param {number} options.windowMs   时间窗口（毫秒），默认 60000（1分钟）
 * @param {number} options.max        窗口内最大请求数，默认 100
 * @param {string} options.message    超限提示信息
 */
function rateLimit({ windowMs = 60_000, max = 100, message = '请求过于频繁，请稍后再试' } = {}) {
  // 定期清理过期记录
  setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of ipStore.entries()) {
      if (now - record.windowStart > windowMs) ipStore.delete(ip);
    }
  }, windowMs);

  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const record = ipStore.get(ip);

    if (!record || now - record.windowStart > windowMs) {
      // 新窗口
      ipStore.set(ip, { windowStart: now, count: 1 });
      return next();
    }

    record.count++;
    if (record.count > max) {
      logger.warn(`[限流] IP ${ip} 超出限制 ${record.count}/${max} 次/分钟`);
      return res.status(429).json({ code: 429, message });
    }
    next();
  };
}

module.exports = rateLimit;
