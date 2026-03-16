const express = require('express');
const path = require('path');
const config = require('./config');

require('./utils/db'); // 初始化数据库

const app = express();
app.use(express.json());

// API 路由
app.use('/api', require('./routes/api'));

// 生产环境托管前端静态文件
if (config.nodeEnv === 'production') {
  const distPath = path.join(__dirname, '../frontend/dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

app.listen(config.port, () => {
  console.log(`[PDD Manager] 服务启动，端口 ${config.port}`);
});

module.exports = app;
