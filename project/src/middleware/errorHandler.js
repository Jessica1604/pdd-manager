'use strict';

const logger = require('../utils/logger');

/**
 * 全局错误处理中间件（必须放在所有路由之后）
 * 统一捕获路由中 next(err) 或 async 路由抛出的错误
 */
function errorHandler(err, req, res, next) {
  // 已发送响应头则交给 Express 默认处理
  if (res.headersSent) return next(err);

  const status = err.status || err.statusCode || 500;
  const message = err.message || '服务器内部错误';

  // 记录错误日志（5xx 才记 error，4xx 记 warn）
  if (status >= 500) {
    logger.error(`[错误] ${req.method} ${req.path} → ${status} ${message}\n${err.stack || ''}`);
    logger.op(`API错误`, `${req.method} ${req.path} ${message}`, 'error');
  } else {
    logger.warn(`[警告] ${req.method} ${req.path} → ${status} ${message}`);
  }

  res.status(status).json({
    code: status,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
}

/**
 * 404 处理（放在所有路由之后、errorHandler 之前）
 */
function notFound(req, res, next) {
  const err = new Error(`接口不存在: ${req.method} ${req.path}`);
  err.status = 404;
  next(err);
}

module.exports = { errorHandler, notFound };
