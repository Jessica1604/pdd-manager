# 拼多多店铺管理系统

基于 Node.js + Vue 3 的拼多多店铺自动化管理系统，集成 DeepSeek AI 智能客服与数据分析。

## 功能特性

- 商品管理（列表、编辑、上下架、库存）
- 订单管理（同步、发货、物流跟踪 - 圆通快递）
- 智能客服（DeepSeek AI 自动回复）
- 数据分析（销售报表、AI 洞察）
- 飞书通知（订单、库存、日报推送）
- 前端管理后台（Vue 3 + Element Plus）

## 技术栈

- 后端：Node.js + Express + SQLite
- 前端：Vue 3 + Vite + Element Plus + Pinia
- AI：DeepSeek API
- 通知：飞书 Webhook
- 部署：腾讯云轻量服务器 + PM2

## 快速开始

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填写各项 API 密钥

# 初始化数据库
npm run db:init

# 启动服务
npm start
```

## 目录结构

```
pdd-manager/
├── src/                    # 后端源码
│   ├── api/                # 拼多多 API 封装
│   ├── services/           # 业务服务层
│   ├── jobs/               # 定时任务
│   ├── utils/              # 工具函数
│   ├── config/             # 配置管理
│   ├── routes/             # API 路由
│   └── app.js              # 应用入口
├── frontend/               # 前端管理后台
│   └── src/
│       ├── views/          # 页面组件
│       ├── components/     # 公共组件
│       ├── stores/         # Pinia 状态
│       ├── api/            # 接口封装
│       └── router/         # 路由配置
├── data/                   # SQLite 数据库
├── logs/                   # 日志文件
├── .env.example            # 环境变量示例
└── package.json
```

## 部署

```bash
npm install -g pm2
pm2 start src/app.js --name pdd-manager
pm2 startup && pm2 save
```
