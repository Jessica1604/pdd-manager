'use strict';

/**
 * 数据分析服务
 * - 销售统计（日/周/月）
 * - 商品分析（热销/滞销/退款率）
 * - AI 洞察（DeepSeek）
 * - 报表生成
 */

const db = require('../utils/db');
const deepseek = require('../utils/deepseek');
const feishu = require('../utils/feishu');
const logger = require('../utils/logger');

// ─── 销售统计 ─────────────────────────────────────────────────────────────────

/**
 * 获取指定日期范围的销售汇总
 * @param {number} shopId
 * @param {string} startDate  YYYY-MM-DD
 * @param {string} endDate    YYYY-MM-DD
 */
function getSalesSummary(shopId, startDate, endDate) {
  const rows = db.prepare(`
    SELECT
      COUNT(*)                          AS orderCount,
      COALESCE(SUM(total_amount), 0)    AS totalAmount,
      COALESCE(AVG(total_amount), 0)    AS avgAmount,
      COUNT(CASE WHEN status='refund' THEN 1 END) AS refundCount
    FROM orders
    WHERE shop_id=? AND DATE(created_at) BETWEEN ? AND ?
  `).get(shopId, startDate, endDate);
  return rows;
}

/**
 * 热销商品 TOP N
 */
function getTopGoods(shopId, startDate, endDate, limit = 10) {
  // goods_info 存的是 JSON 数组，这里按订单数统计（简化版）
  return db.prepare(`
    SELECT goods_info, COUNT(*) AS orderCount, SUM(total_amount) AS totalAmount
    FROM orders
    WHERE shop_id=? AND DATE(created_at) BETWEEN ? AND ? AND status != 'refund'
    GROUP BY goods_info
    ORDER BY orderCount DESC
    LIMIT ?
  `).all(shopId, startDate, endDate, limit);
}

/**
 * 每日销售趋势（最近 N 天）
 */
function getDailyTrend(shopId, days = 7) {
  return db.prepare(`
    SELECT
      DATE(created_at)               AS date,
      COUNT(*)                       AS orderCount,
      COALESCE(SUM(total_amount), 0) AS totalAmount
    FROM orders
    WHERE shop_id=? AND DATE(created_at) >= DATE('now', ? || ' days')
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `).all(shopId, `-${days}`);
}

/**
 * 库存周转分析（低库存 + 滞销）
 */
function getStockAnalysis(shopId) {
  const lowStock = db.prepare(
    "SELECT * FROM goods WHERE shop_id=? AND stock<=10 AND status='on' ORDER BY stock ASC"
  ).all(shopId);

  const overStock = db.prepare(
    "SELECT * FROM goods WHERE shop_id=? AND stock>=200 AND status='on' ORDER BY stock DESC LIMIT 20"
  ).all(shopId);

  return { lowStock, overStock };
}

// ─── AI 分析 ──────────────────────────────────────────────────────────────────

/**
 * 生成 AI 销售洞察
 */
async function generateAiInsight(shopId, date) {
  const d = date || new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const summary = getSalesSummary(shopId, yesterday, yesterday);
  const trend = getDailyTrend(shopId, 7);
  const { lowStock } = getStockAnalysis(shopId);

  const salesData = {
    date: yesterday,
    orderCount: summary.orderCount,
    totalAmount: summary.totalAmount.toFixed(2),
    avgAmount: summary.avgAmount.toFixed(2),
    refundCount: summary.refundCount,
    refundRate: summary.orderCount > 0
      ? ((summary.refundCount / summary.orderCount) * 100).toFixed(1) + '%'
      : '0%',
    trend7Days: trend.map(t => ({ date: t.date, orders: t.orderCount, amount: t.totalAmount.toFixed(2) })),
    lowStockCount: lowStock.length,
  };

  try {
    const insight = await deepseek.analyzeSales(salesData);
    // 缓存到 config 表
    db.prepare(`
      INSERT INTO config (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP
    `).run(`ai_insight_${shopId}_${yesterday}`, insight);
    return insight;
  } catch (err) {
    logger.error(`[分析] AI 洞察生成失败: ${err.message}`);
    return null;
  }
}

// ─── 报表生成 ─────────────────────────────────────────────────────────────────

/**
 * 生成并推送每日日报
 */
async function sendDailyReport(shopId, shopName) {
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  logger.info(`[日报] 店铺 ${shopId} 生成 ${yesterday} 日报...`);

  const summary = getSalesSummary(shopId, yesterday, yesterday);
  const topGoods = getTopGoods(shopId, yesterday, yesterday, 5);

  // 尝试获取 AI 洞察（失败不阻断报表）
  let aiSuggestion = db.prepare('SELECT value FROM config WHERE key=?')
    .get(`ai_insight_${shopId}_${yesterday}`)?.value;

  if (!aiSuggestion) {
    aiSuggestion = await generateAiInsight(shopId, yesterday) || '（AI 分析暂不可用）';
  }

  const topList = topGoods.map(g => {
    try { const items = JSON.parse(g.goods_info); return { name: items[0]?.goods_name || '未知商品', count: g.orderCount }; }
    catch { return { name: '商品', count: g.orderCount }; }
  });

  await feishu.sendDailyReport(shopName, {
    date: yesterday,
    totalAmount: summary.totalAmount,
    orderCount: summary.orderCount,
    topGoods: topList,
    aiSuggestion,
  });

  logger.info(`[日报] 店铺 ${shopId} 日报已推送`);
  return { summary, aiSuggestion };
}

/**
 * 生成并推送每周周报
 */
async function sendWeeklyReport(shopId, shopName) {
  const today = new Date();
  const endDate = new Date(today - 86400000).toISOString().slice(0, 10);
  const startDate = new Date(today - 7 * 86400000).toISOString().slice(0, 10);

  const summary = getSalesSummary(shopId, startDate, endDate);
  const trend = getDailyTrend(shopId, 7);
  const { lowStock } = getStockAnalysis(shopId);

  const salesData = {
    period: `${startDate} ~ ${endDate}`,
    orderCount: summary.orderCount,
    totalAmount: summary.totalAmount.toFixed(2),
    refundRate: summary.orderCount > 0
      ? ((summary.refundCount / summary.orderCount) * 100).toFixed(1) + '%' : '0%',
    trend7Days: trend.map(t => `${t.date}: ${t.orderCount}单 ¥${t.totalAmount.toFixed(2)}`).join('\n'),
    lowStockCount: lowStock.length,
  };

  let aiSuggestion = '（AI 分析暂不可用）';
  try {
    aiSuggestion = await deepseek.analyzeSales(salesData);
  } catch (err) {
    logger.warn(`[周报] AI 分析失败: ${err.message}`);
  }

  await feishu.sendCard(
    `📈 每周经营周报 · ${shopName} · ${startDate}~${endDate}`,
    [
      `💰 **周销售额：** ¥${summary.totalAmount.toFixed(2)}`,
      `📦 **周订单量：** ${summary.orderCount} 单`,
      `🔄 **退款率：** ${salesData.refundRate}`,
      `⚠️ **低库存商品：** ${lowStock.length} 件`,
      '',
      `🤖 **AI 经营建议：**\n${aiSuggestion}`,
    ],
    'blue'
  );

  logger.info(`[周报] 店铺 ${shopId} 周报已推送`);
}

module.exports = {
  getSalesSummary,
  getTopGoods,
  getDailyTrend,
  getStockAnalysis,
  generateAiInsight,
  sendDailyReport,
  sendWeeklyReport,
};
