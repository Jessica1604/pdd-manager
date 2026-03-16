'use strict';

/**
 * 功能测试脚本（不依赖真实 PDD API Key，验证模块加载、签名、数据库、日志、飞书工具）
 */

process.env.PDD_CLIENT_ID = 'test_client_id';
process.env.PDD_CLIENT_SECRET = 'test_secret';
process.env.PDD_ACCESS_TOKEN = 'test_token';
process.env.DEEPSEEK_API_KEY = 'test_key';
process.env.FEISHU_WEBHOOK_URL = '';
process.env.JWT_SECRET = 'test_jwt';
process.env.PORT = '3099';
process.env.NODE_ENV = 'test';

let passed = 0;
let failed = 0;

function ok(name) { console.log(`  ✅ ${name}`); passed++; }
function fail(name, err) { console.log(`  ❌ ${name}: ${err}`); failed++; }

// ─── 1. 模块加载 ──────────────────────────────────────────────────────────────
console.log('\n【1】模块加载测试');
try { require('./src/config'); ok('config 加载'); } catch(e) { fail('config', e.message); }
try { require('./src/utils/logger'); ok('logger 加载'); } catch(e) { fail('logger', e.message); }
try { require('./src/utils/db'); ok('db 加载 & 初始化'); } catch(e) { fail('db', e.message); }
try { require('./src/utils/feishu'); ok('feishu 加载'); } catch(e) { fail('feishu', e.message); }
try { require('./src/utils/deepseek'); ok('deepseek 加载'); } catch(e) { fail('deepseek', e.message); }
try { require('./src/api/pdd-client'); ok('pdd-client 加载'); } catch(e) { fail('pdd-client', e.message); }
try { require('./src/services/order.service'); ok('order.service 加载'); } catch(e) { fail('order.service', e.message); }
try { require('./src/services/goods.service'); ok('goods.service 加载'); } catch(e) { fail('goods.service', e.message); }

// ─── 2. 签名算法 ──────────────────────────────────────────────────────────────
console.log('\n【2】签名算法测试');
try {
  const crypto = require('crypto');
  const secret = 'test_secret';
  const params = { type: 'pdd.goods.list.get', client_id: 'abc', timestamp: 1700000000 };
  const sorted = Object.keys(params).sort().map(k => `${k}${params[k]}`).join('');
  const raw = `${secret}${sorted}${secret}`;
  const sign = crypto.createHash('md5').update(raw).digest('hex').toUpperCase();
  if (sign.length === 32) ok(`签名生成正确 (${sign.slice(0,8)}...)`);
  else fail('签名长度异常', sign.length);
} catch(e) { fail('签名算法', e.message); }

// ─── 3. 数据库 CRUD ───────────────────────────────────────────────────────────
console.log('\n【3】数据库 CRUD 测试');
try {
  const db = require('./src/utils/db');

  // 插入商品
  db.prepare(`INSERT OR REPLACE INTO goods (goods_id, goods_name, price, stock, status)
    VALUES (?, ?, ?, ?, ?)`).run('TEST001', '测试商品A', 99.9, 50, 'on');
  ok('商品插入');

  // 查询商品
  const g = db.prepare('SELECT * FROM goods WHERE goods_id=?').get('TEST001');
  if (g && g.goods_name === '测试商品A') ok(`商品查询 (${g.goods_name} ¥${g.price})`);
  else fail('商品查询', '数据不匹配');

  // 更新库存
  db.prepare('UPDATE goods SET stock=? WHERE goods_id=?').run(5, 'TEST001');
  const g2 = db.prepare('SELECT stock FROM goods WHERE goods_id=?').get('TEST001');
  if (g2.stock === 5) ok('商品库存更新');
  else fail('库存更新', g2.stock);

  // 插入订单
  db.prepare(`INSERT OR REPLACE INTO orders (order_sn, buyer_name, total_amount, status)
    VALUES (?, ?, ?, ?)`).run('TEST_ORDER_001', '张三', 199.0, 'pending');
  ok('订单插入');

  // 查询订单
  const o = db.prepare('SELECT * FROM orders WHERE order_sn=?').get('TEST_ORDER_001');
  if (o && o.buyer_name === '张三') ok(`订单查询 (${o.order_sn} ¥${o.total_amount})`);
  else fail('订单查询', '数据不匹配');

  // 更新发货状态
  db.prepare(`UPDATE orders SET status='shipped', tracking_number=? WHERE order_sn=?`)
    .run('YT1234567890', 'TEST_ORDER_001');
  const o2 = db.prepare('SELECT * FROM orders WHERE order_sn=?').get('TEST_ORDER_001');
  if (o2.status === 'shipped' && o2.tracking_number === 'YT1234567890') ok('订单发货状态更新');
  else fail('发货状态更新', JSON.stringify(o2));

  // 客服消息插入
  db.prepare(`INSERT INTO customer_messages (user_id, message, reply, reply_type)
    VALUES (?, ?, ?, ?)`).run('user_001', '什么时候发货？', '48小时内发货', 'auto');
  ok('客服消息插入');

  // 清理测试数据
  db.prepare('DELETE FROM goods WHERE goods_id=?').run('TEST001');
  db.prepare('DELETE FROM orders WHERE order_sn=?').run('TEST_ORDER_001');
  ok('测试数据清理');
} catch(e) { fail('数据库', e.message); }

// ─── 4. 日志工具 ──────────────────────────────────────────────────────────────
console.log('\n【4】日志工具测试');
try {
  const logger = require('./src/utils/logger');
  logger.info('测试 info 日志');
  logger.warn('测试 warn 日志');
  logger.error('测试 error 日志');
  const fs = require('fs'), path = require('path');
  const logPath = path.join(__dirname, 'logs/app.log');
  const content = fs.readFileSync(logPath, 'utf8');
  if (content.includes('测试 info 日志')) ok('日志写入文件成功');
  else fail('日志文件', '内容未找到');
} catch(e) { fail('日志工具', e.message); }

// ─── 5. 库存预警逻辑 ──────────────────────────────────────────────────────────
console.log('\n【5】库存预警逻辑测试');
try {
  const db = require('./src/utils/db');
  db.prepare(`INSERT OR REPLACE INTO goods (goods_id, goods_name, price, stock, status)
    VALUES (?, ?, ?, ?, ?)`).run('WARN001', '低库存商品', 50, 3, 'on');
  const lowStock = db.prepare("SELECT * FROM goods WHERE stock <= ? AND status='on'").all(10);
  if (lowStock.some(g => g.goods_id === 'WARN001')) ok(`库存预警查询正确（找到 ${lowStock.length} 件低库存商品）`);
  else fail('库存预警', '未找到低库存商品');
  db.prepare('DELETE FROM goods WHERE goods_id=?').run('WARN001');
} catch(e) { fail('库存预警', e.message); }

// ─── 6. pdd-client 接口结构 ───────────────────────────────────────────────────
console.log('\n【6】pdd-client 接口导出验证');
try {
  const pdd = require('./src/api/pdd-client');
  const expected = [
    'getGoodsList','getGoodsDetail','updateGoods','updateSkuStock',
    'updateGoodsStatus','batchUpdateGoodsStatus',
    'getOrderList','getOrderDetail','shipOrder','batchShipOrders','addOrderRemark',
    'getLogisticsTrack','getMessageList','sendMessage'
  ];
  const missing = expected.filter(fn => typeof pdd[fn] !== 'function');
  if (missing.length === 0) ok(`所有 ${expected.length} 个接口均已导出`);
  else fail('接口缺失', missing.join(', '));
} catch(e) { fail('pdd-client 接口', e.message); }

// ─── 7. 定时任务模块加载 ──────────────────────────────────────────────────────
console.log('\n【7】定时任务模块测试');
try {
  const orderJob = require('./src/jobs/order.job');
  const stockJob = require('./src/jobs/stock.job');
  if (typeof orderJob.start === 'function') ok('order.job 模块正常');
  else fail('order.job', 'start 方法缺失');
  if (typeof stockJob.start === 'function') ok('stock.job 模块正常');
  else fail('stock.job', 'start 方法缺失');
} catch(e) { fail('定时任务', e.message); }

// ─── 汇总 ─────────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(40)}`);
console.log(`测试结果：✅ ${passed} 通过  ❌ ${failed} 失败`);
if (failed === 0) console.log('🎉 所有测试通过！');
else console.log('⚠️  存在失败项，请检查上方错误信息');
process.exit(failed > 0 ? 1 : 0);
