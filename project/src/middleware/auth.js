'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * JWT 鉴权中间件
 * 请求头需携带：Authorization: Bearer <token>
 */
function auth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ code: 401, message: '未登录，请先获取 token' });
  try {
    req.user = jwt.verify(token, config.jwt.secret);
    next();
  } catch {
    res.status(401).json({ code: 401, message: 'token 无效或已过期' });
  }
}

module.exports = auth;
