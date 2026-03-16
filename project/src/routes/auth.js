'use strict';

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config');

/**
 * POST /auth/login
 * body: { username, password }
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.json({ code: 1, message: '用户名和密码不能为空' });
  }

  // 对比用户名
  if (username !== config.admin.username) {
    return res.json({ code: 1, message: '用户名或密码错误' });
  }

  // 密码支持明文（开发）和 bcrypt hash（生产）
  const storedPwd = config.admin.password;
  const valid = storedPwd.startsWith('$2')
    ? await bcrypt.compare(password, storedPwd)
    : password === storedPwd;

  if (!valid) {
    return res.json({ code: 1, message: '用户名或密码错误' });
  }

  const token = jwt.sign(
    { username, role: 'admin' },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  res.json({ code: 0, data: { token, expiresIn: config.jwt.expiresIn }, message: '登录成功' });
});

module.exports = router;
