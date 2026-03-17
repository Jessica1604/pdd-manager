'use strict';

const logger = require('../utils/logger');

/**
 * 响应时间监控 + 访问日志中间件
 * - 所有请求写 access 日志
 * - 超过阈值打印慢请求警告
 */
function responseTime(thresholdMs = 2000) {
  return (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      logger.access(req.method, req.path, res.statusCode, ms);
      if (ms > thresholdMs) {
        logger.warn(`[慢请求] ${req.method} ${req.path} ${res.statusCode} ${ms}ms`);
      }
    });
    next();
  };
}

module.exports = responseTime;
