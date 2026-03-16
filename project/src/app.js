'use strict';

require('dotenv').config();

const express = require('express');
const path = require('path');
const config = require('./config');
const logger = require('./utils/logger');

require('./utils/db'); // 初始化数据库

const app = express();
app.use(express.json());

// 登录接口（无需鉴权）
app.use('/auth', require('./routes/auth'));

// 业务 API（需要 JWT 鉴权）
const auth = require('./middleware/auth');
app.use('/api', auth, require('./routes/api'));

// 启动定时任务
require('./jobs/order.job').start();
require('./jobs/stock.job').start();

// 生产环境托管前端静态文件
if (config.nodeEnv === 'production') {
  const distPath = path.join(__dirname, '../frontend/dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

app.listen(config.port, () => {
  logger.info(`[PDD Manager] 服务启动，端口 ${config.port}`);
});

module.exports = app;
