# 拼多多店铺管理系统 - 需求文档

## 1. 项目概述

### 1.1 项目目标
构建一个基于 Node.js 的拼多多店铺自动化管理系统，通过拼多多开放平台 API 实现商品管理、订单处理、客服自动化、数据分析等功能，并集成 DeepSeek AI 提供智能化服务。

### 1.2 技术栈
- **后端框架：** Node.js + Express
- **数据库：** SQLite（可扩展为 MySQL/PostgreSQL）
- **定时任务：** node-cron
- **AI 服务：** DeepSeek API
- **通知服务：** 飞书 Webhook
- **部署环境：** 腾讯云轻量应用服务器（已有）
- **前端框架：** Vue 3 + Vite（管理后台）
- **UI 组件库：** Element Plus
- **状态管理：** Pinia
- **HTTP 客户端：** Axios

### 1.3 核心原则
- 无需额外后端服务器成本（使用现有云服务器）
- 图片和临时数据使用内存处理，不落盘存储
- API 密钥通过环境变量管理
- 模块化设计，便于扩展

---

## 2. 功能需求

### 2.1 商品管理

#### 2.1.1 商品列表查询
- 获取店铺所有商品列表
- 支持按状态筛选（上架/下架/审核中）
- 支持分页查询
- 返回商品基本信息（ID、标题、价格、库存、状态）

#### 2.1.2 商品信息编辑
- 修改商品标题、描述
- 更新商品价格
- 调整商品库存
- 修改商品图片
- 更新商品规格（SKU）

#### 2.1.3 商品上下架
- 批量上架商品
- 批量下架商品
- 定时上下架（支持预约）

#### 2.1.4 库存管理
- 实时库存同步
- 库存预警（低于阈值时飞书通知）
- 批量库存调整

---

### 2.2 订单管理

#### 2.2.1 订单查询
- 获取待发货订单列表
- 获取已发货订单列表
- 获取退款/售后订单
- 订单详情查询（买家信息、商品明细、物流信息）

#### 2.2.2 订单处理
- 自动获取新订单（定时任务，每 5 分钟）
- 批量发货（支持导入物流单号）
- 订单备注添加
- 异常订单标记

#### 2.2.3 物流管理
- 物流公司：仅支持圆通快递
- 自动填写物流单号
- 物流状态跟踪
- 物流异常提醒

#### 2.2.4 订单通知
- 新订单飞书通知
- 退款申请飞书通知
- 发货失败飞书通知
- 每日订单汇总报告

---

### 2.3 客服自动化

#### 2.3.1 智能客服（DeepSeek AI）
- 自动回复常见问题（FAQ 匹配）
- 复杂问题 AI 生成回复（调用 DeepSeek）
- 订单查询自动回复
- 物流查询自动回复

#### 2.3.2 客服规则引擎
- 关键词匹配自动回复（不调用 AI，节省成本）
- 预设回复模板管理
- 敏感词过滤
- 人工介入触发条件

#### 2.3.3 客服数据统计
- 每日咨询量统计
- AI 回复准确率
- 人工介入次数
- 常见问题 TOP 10

---

### 2.4 数据分析

#### 2.4.1 销售数据统计
- 每日销售额
- 每日订单量
- 热销商品 TOP 10
- 销售趋势图（7 天/30 天）

#### 2.4.2 商品分析
- 商品转化率
- 商品退款率
- 库存周转率
- 滞销商品识别

#### 2.4.3 AI 数据洞察（DeepSeek）
- 销售数据智能分析
- 经营建议生成
- 异常数据预警
- 竞品价格监控建议

#### 2.4.4 报表生成
- 每日销售报表（自动生成并推送飞书）
- 每周经营分析报告
- 每月财务汇总

---

### 2.5 营销工具

#### 2.5.1 优惠券管理
- 创建优惠券
- 查询优惠券使用情况
- 优惠券到期提醒

#### 2.5.2 活动管理
- 活动报名（拼多多平台活动）
- 活动商品价格调整
- 活动效果跟踪

#### 2.5.3 价格监控
- 竞品价格监控（需手动配置竞品）
- 价格变动提醒
- 自动调价建议（AI 生成）

---

## 2.6 前端管理后台

### 2.6.1 整体设计
- 基于 Vue 3 + Element Plus 构建单页应用（SPA）
- 响应式布局，支持桌面端浏览器访问
- 侧边栏导航 + 顶部状态栏布局
- 统一的登录鉴权（JWT Token）

### 2.6.2 数据概览（Dashboard）
- 今日销售额、订单量、退款量实时卡片展示
- 近 7 天 / 近 30 天销售趋势折线图
- 热销商品 TOP 10 排行榜
- 库存预警商品列表（红色高亮）
- 系统运行状态（定时任务状态、API 调用次数）

### 2.6.3 商品管理页
- 商品列表表格（支持分页、搜索、状态筛选）
- 商品详情弹窗（查看/编辑标题、价格、库存、状态）
- 批量上架 / 下架操作
- 库存快速修改（行内编辑）
- 商品图片预览

### 2.6.4 订单管理页
- 订单列表表格（支持按状态、时间范围筛选）
- 订单详情弹窗（买家信息、商品明细、物流信息）
- 手动发货操作（填写物流公司 + 单号）
- 批量发货（CSV 导入物流单号）
- 订单备注添加
- 一键手动同步订单按钮

### 2.6.5 客服管理页
- 客服消息记录列表（展示消息、回复类型、时间）
- 回复类型标签区分（自动/AI/人工）
- 预设回复模板管理（增删改查）
- 关键词规则配置（关键词 → 自动回复内容）
- 每日咨询量统计图表

### 2.6.6 数据分析页
- 销售数据多维度图表（折线图、柱状图、饼图）
- 商品转化率 / 退款率分析表格
- AI 分析报告展示区（Markdown 渲染）
- 手动触发生成日报 / 周报按钮
- 历史报告列表（可查看往期报告）

### 2.6.7 系统设置页
- 飞书 Webhook 地址配置
- 库存预警阈值配置
- 定时任务开关与频率配置
- DeepSeek AI 调用上限配置
- 操作日志查看

### 2.6.8 前端与后端对接
- 后端新增 RESTful API 路由（`/api/v1/...`）供前端调用
- 统一响应格式：`{ code, data, message }`
- JWT 登录鉴权（用户名/密码，单用户即可）
- 前端开发时通过 Vite proxy 代理后端接口
- 生产环境由 Express 托管前端静态文件（`frontend/dist`）

---

## 3. 非功能需求

### 3.1 性能要求
- API 响应时间 < 2 秒
- 定时任务执行间隔：5 分钟（订单）、1 小时（库存）、24 小时（报表）
- 支持并发处理 100+ 订单

### 3.2 安全要求
- API 密钥通过环境变量存储
- 敏感数据加密存储（买家手机号、地址）
- 日志记录所有 API 调用
- 防止 API 滥用（请求频率限制）

### 3.3 可靠性要求
- 定时任务失败自动重试（最多 3 次）
- 关键操作日志记录
- 异常情况飞书告警
- 数据库定期备份

### 3.4 可维护性要求
- 代码模块化，单一职责
- 完善的注释和文档
- 统一的错误处理
- 配置文件与代码分离

---

## 4. 系统架构

### 4.1 目录结构
```
pdd-manager/
├── src/
│   ├── api/
│   │   └── pdd-client.js          # 拼多多 API 封装
│   ├── services/
│   │   ├── order.service.js       # 订单服务
│   │   ├── goods.service.js       # 商品服务
│   │   ├── customer.service.js    # 客服服务
│   │   └── analytics.service.js   # 数据分析服务
│   ├── jobs/
│   │   ├── order.job.js           # 订单定时任务
│   │   ├── stock.job.js           # 库存定时任务
│   │   └── report.job.js          # 报表定时任务
│   ├── utils/
│   │   ├── feishu.js              # 飞书通知工具
│   │   ├── deepseek.js              # DeepSeek API 工具
│   │   ├── logger.js              # 日志工具
│   │   └── db.js                  # 数据库工具
│   ├── config/
│   │   └── index.js               # 配置管理
│   ├── routes/
│   │   └── api.js                 # API 路由（可选，用于手动触发）
│   └── app.js                     # 应用入口
├── frontend/                      # 前端管理后台
│   ├── src/
│   │   ├── views/
│   │   │   ├── Dashboard.vue      # 数据概览
│   │   │   ├── Goods.vue          # 商品管理
│   │   │   ├── Orders.vue         # 订单管理
│   │   │   ├── Customer.vue       # 客服管理
│   │   │   └── Analytics.vue      # 数据分析
│   │   ├── components/            # 公共组件
│   │   ├── stores/                # Pinia 状态管理
│   │   ├── api/                   # Axios 请求封装
│   │   ├── router/                # Vue Router 路由
│   │   └── main.js
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── data/
│   └── pdd.db                     # SQLite 数据库
├── logs/
│   └── app.log                    # 日志文件
├── .env                           # 环境变量（不提交到 Git）
├── .env.example                   # 环境变量示例
├── package.json
├── README.md
└── .gitignore
```

### 4.2 数据库设计

#### 4.2.1 商品表 (goods)
```sql
CREATE TABLE goods (
  id INTEGER PRIMARY KEY,
  goods_id TEXT UNIQUE NOT NULL,
  goods_name TEXT,
  price REAL,
  stock INTEGER,
  status TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 4.2.2 订单表 (orders)
```sql
CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  order_sn TEXT UNIQUE NOT NULL,
  buyer_name TEXT,
  buyer_phone TEXT,
  buyer_address TEXT,
  goods_info TEXT,
  total_amount REAL,
  status TEXT,
  logistics_id TEXT,
  tracking_number TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 4.2.3 客服记录表 (customer_messages)
```sql
CREATE TABLE customer_messages (
  id INTEGER PRIMARY KEY,
  user_id TEXT,
  message TEXT,
  reply TEXT,
  reply_type TEXT, -- 'auto' | 'ai' | 'manual'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 4.2.4 配置表 (config)
```sql
CREATE TABLE config (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 5. 接口设计

### 5.1 拼多多 API 封装

#### 5.1.1 商品相关
```javascript
// 获取商品列表
pddClient.getGoodsList({ page, pageSize, status })

// 更新商品信息
pddClient.updateGoods(goodsId, { name, price, stock })

// 上下架商品
pddClient.updateGoodsStatus(goodsId, status)
```

#### 5.1.2 订单相关
```javascript
// 获取订单列表
pddClient.getOrderList({ status, startTime, endTime })

// 发货
pddClient.shipOrder(orderSn, { logisticsId, trackingNumber })

// 获取订单详情
pddClient.getOrderDetail(orderSn)
```

### 5.2 内部 API（可选）

#### 5.2.1 手动触发接口
```
POST /api/sync/orders      # 手动同步订单
POST /api/sync/goods       # 手动同步商品
POST /api/report/daily     # 手动生成日报
```

---

## 6. 定时任务设计

### 6.1 订单同步任务
- **频率：** 每 5 分钟
- **功能：** 获取新订单，存入数据库，发送飞书通知
- **异常处理：** 失败重试 3 次，仍失败则告警

### 6.2 库存检查任务
- **频率：** 每 1 小时
- **功能：** 检查库存，低于阈值时告警
- **阈值：** 可配置（默认 10 件）

### 6.3 日报生成任务
- **频率：** 每天 00:00
- **功能：** 生成前一天销售数据，调用 DeepSeek 分析，推送飞书
- **内容：** 销售额、订单量、热销商品、AI 建议

### 6.4 周报生成任务
- **频率：** 每周一 09:00
- **功能：** 生成上周经营分析报告
- **内容：** 周销售趋势、商品分析、经营建议

---

## 7. DeepSeek AI 集成

### 7.1 使用场景

#### 7.1.1 客服自动回复
```javascript
// 输入：客户消息 + 店铺 FAQ + 订单上下文
// 输出：回复内容
const reply = await deepseek.complete({
  model: 'deepseek-chat', // 低成本对话模型
  max_tokens: 200,
  messages: [{
    role: 'user',
    content: `你是拼多多店铺客服。
    
客户问题：${customerMessage}

店铺FAQ：
- 发货时间：下单后 48 小时内发货
- 退换货：7 天无理由退换
- 物流：默认使用圆通快递

请简洁专业地回复客户。`
  }]
});
```

#### 7.1.2 数据分析
```javascript
// 输入：销售数据
// 输出：分析报告 + 建议
const analysis = await deepseek.complete({
  model: 'deepseek-reasoner', // 深度推理模型
  max_tokens: 1000,
  messages: [{
    role: 'user',
    content: `分析以下销售数据并给出经营建议：

销售数据：
- 昨日销售额：¥12,580
- 昨日订单量：156 单
- 热销商品：商品A (50单)、商品B (30单)
- 退款率：2.3%
- 库存预警：商品C 仅剩 5 件

请给出：
1. 数据分析
2. 经营建议
3. 需要关注的问题`
  }]
});
```

### 7.2 成本控制策略
- 简单问题用关键词匹配，不调用 AI
- 客服使用 deepseek-chat 模型（低成本对话）
- 数据分析使用 deepseek-reasoner 模型（深度推理）
- 设置每日调用上限（如 1000 次）
- 缓存常见问题的 AI 回复

---

## 8. 飞书通知设计

### 8.1 通知类型

#### 8.1.1 实时通知
- 新订单通知
- 退款申请通知
- 库存预警通知
- 系统异常告警

#### 8.1.2 定时报告
- 每日销售日报（00:00）
- 每周经营周报（周一 09:00）
- 每月财务月报（1 号 09:00）

### 8.2 消息格式示例

#### 新订单通知
```
📦 新订单提醒

订单号：PDD20260313001
商品：商品名称 x 2
金额：¥99.00
买家：张三
地址：广东省深圳市...

[查看详情] [立即发货]
```

#### 日报
```
📊 每日销售日报 (2026-03-13)

💰 销售额：¥12,580
📦 订单量：156 单
🔥 热销商品：
  1. 商品A - 50单
  2. 商品B - 30单
  3. 商品C - 25单

⚠️ 需要关注：
- 商品C 库存仅剩 5 件，建议补货
- 退款率 2.3%，略高于平均水平

🤖 AI 建议：
[DeepSeek 生成的经营建议]
```

---

## 9. 部署方案

### 9.1 环境准备
```bash
# 安装 Node.js（已有）
node -v  # v22.22.1

# 安装 PM2（进程管理）
npm install -g pm2

# 安装 SQLite（已有）
sqlite3 --version
```

### 9.2 部署步骤
```bash
# 1. 克隆/创建项目
cd /root/.openclaw/workspace
mkdir pdd-manager && cd pdd-manager

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
vim .env  # 填写 API 密钥

# 4. 初始化数据库
npm run db:init

# 5. 启动服务
pm2 start src/app.js --name pdd-manager

# 6. 查看日志
pm2 logs pdd-manager

# 7. 设置开机自启
pm2 startup
pm2 save
```

### 9.3 环境变量配置
```bash
# .env 文件内容
PDD_CLIENT_ID=your_client_id
PDD_CLIENT_SECRET=your_client_secret
PDD_ACCESS_TOKEN=your_access_token

DEEPSEEK_API_KEY=your_deepseek_api_key

FEISHU_WEBHOOK_URL=your_feishu_webhook_url

# 可选配置
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
```

---

## 10. 开发计划

### 10.1 第一阶段（核心功能）
- [ ] 拼多多 API 封装
- [ ] 订单同步与通知
- [ ] 商品管理基础功能
- [ ] 飞书通知集成
- [ ] 数据库设计与实现
- [ ] 后端 RESTful API 接口

### 10.2 第二阶段（智能化）
- [ ] DeepSeek 客服集成
- [ ] 数据分析与报表
- [ ] 库存预警
- [ ] 定时任务完善

### 10.3 第三阶段（前端管理后台）
- [ ] Vue 3 + Vite 项目初始化
- [ ] 登录鉴权（JWT）
- [ ] Dashboard 数据概览页
- [ ] 商品管理页
- [ ] 订单管理页
- [ ] 客服管理页
- [ ] 数据分析页
- [ ] 系统设置页

### 10.4 第四阶段（优化）
- [ ] 性能优化
- [ ] 错误处理完善
- [ ] 日志系统
- [ ] 监控告警

---

## 11. 风险与挑战

### 11.1 技术风险
- **拼多多 API 限流：** 需要合理控制请求频率
- **DeepSeek API 成本：** 需要合理控制调用次数
- **数据安全：** 买家信息需加密存储

### 11.2 业务风险
- **API 权限：** 需要拼多多开放平台审核通过
- **规则变化：** 拼多多平台规则可能调整
- **依赖稳定性：** 依赖第三方 API 的可用性

### 11.3 应对措施
- 实现请求队列，避免 API 限流
- 设置 DeepSeek 调用上限和缓存机制
- 敏感数据加密，日志脱敏
- 定期备份数据库
- 监控 API 调用状态，异常及时告警

---

## 12. 后续扩展

### 12.1 功能扩展
- 多店铺管理
- 供应链对接
- 财务管理
- 员工权限管理

### 12.2 技术扩展
- 迁移到 TypeScript
- 引入消息队列（Redis）
- 微服务化
- 移动端适配（PWA）

---

## 附录

### A. 拼多多开放平台文档
- 官网：https://open.pinduoduo.com/
- API 文档：https://open.pinduoduo.com/application/document/browse

### B. DeepSeek API 文档
- 官网：https://www.deepseek.com/
- API 文档：https://platform.deepseek.com/api-docs

### C. 参考资料
- Node.js 官方文档
- Express 框架文档
- node-cron 文档
- SQLite 文档

---

**文档版本：** v1.2  
**创建日期：** 2026-03-13  
**最后更新：** 2026-03-16（AI 服务替换为 DeepSeek；物流限定为圆通快递）
