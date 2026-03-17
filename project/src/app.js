'use strict';

require('dotenv').config();

const express = require('express');
const path = require('path');
const config = require('./config');
const logger = require('./utils/logger');

// ── 进程级异常捕获（防止进程崩溃）────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  logger.error(`[uncaughtException] ${err.message}\n${err.stack}`);
  // 给日志写入留出时间后退出，由 pm2 自动重启
  setTimeout(() => process.exit(1), 500);
});

process.on('unhandledRejection', (reason) => {
  logger.error(`[unhandledRejection] ${reason instanceof Error ? reason.stack : reason}`);
});

require('./utils/db');

const app = express();
app.use(express.json());

// 响应时间监控
const responseTime = require('./middleware/responseTime');
app.use(responseTime(2000));

// 全局限流：每 IP 每分钟最多 200 次
const rateLimit = require('./middleware/rateLimit');
app.use(rateLimit({ windowMs: 60_000, max: 200 }));

// 登录接口（无需鉴权）
app.use('/api/v1/auth', require('./routes/auth'));

// 业务 API（JWT 鉴权）
const auth = require('./middleware/auth');
app.use('/api/v1', auth, require('./routes/api'));
app.use('/api/v1', auth, require('./routes/analytics'));
app.use('/api/v1', auth, require('./routes/dashboard'));
app.use('/api/v1', auth, require('./routes/settings'));

// 启动定时任务
require('./jobs/order.job').start();
require('./jobs/stock.job').start();
require('./jobs/report.job').start();
require('./jobs/monitor.job').start();

// 生产环境托管前端
if (config.nodeEnv === 'production') {
  const distPath = path.join(__dirname, '../frontend/dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

// ── 错误处理（必须在所有路由之后）────────────────────────────────────────────
const { notFound, errorHandler } = require('./middleware/errorHandler');
app.use(notFound);
app.use(errorHandler);

app.listen(config.port, () => {
  logger.info(`[PDD Manager] 服务启动，端口 ${config.port}`);
});

module.exports = app;
