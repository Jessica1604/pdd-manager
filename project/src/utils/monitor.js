'use strict';

/**
 * 监控告警中心
 * - 统一的告警入口，支持去重（同类告警冷却期内不重复发送）
 * - 告警级别：critical（红）/ warning（橙）/ info（蓝）
 * - 告警类型：job_fail / api_error / stock / system / custom
 */

const feishu = require('./feishu');
const logger = require('./logger');

// 告警冷却记录（key → lastAlertTime）
const cooldowns = new Map();

// 默认冷却时间（同类告警 10 分钟内不重复发送）
const DEFAULT_COOLDOWN_MS = 10 * 60 * 1000;

/**
 * 发送告警
 * @param {object} opts
 * @param {string} opts.type       告警类型（用于去重 key）
 * @param {string} opts.title      告警标题
 * @param {string} opts.detail     告警详情
 * @param {'critical'|'warning'|'info'} opts.level  告警级别
 * @param {number} opts.cooldownMs 冷却时间（毫秒），0 表示不去重
 */
async function alert({ type, title, detail, level = 'warning', cooldownMs = DEFAULT_COOLDOWN_MS }) {
  // 去重检查
  if (cooldownMs > 0) {
    const last = cooldowns.get(type);
    if (last && Date.now() - last < cooldownMs) {
      logger.debug(`[告警] 冷却中，跳过: ${type}`);
      return;
    }
    cooldowns.set(type, Date.now());
  }

  const colorMap = { critical: 'red', warning: 'orange', info: 'blue' };
  const emojiMap = { critical: '🚨', warning: '⚠️', info: 'ℹ️' };
  const color = colorMap[level] || 'orange';
  const emoji = emojiMap[level] || '⚠️';

  const fullTitle = `${emoji} ${title}`;
  const lines = [
    detail,
    `**时间：** ${new Date().toLocaleString('zh-CN')}`,
    `**级别：** ${level.toUpperCase()}`
  ];

  logger.warn(`[告警] [${level}] ${title}: ${detail}`);
  logger.op(`告警-${type}`, `${title}: ${detail}`, level === 'critical' ? 'error' : 'success');

  await feishu.sendCard(fullTitle, lines, color);
}

// ── 预置告警快捷方法 ──────────────────────────────────────────────────────────

/** 定时任务失败告警 */
async function jobFail(jobName, shopName, errMsg, failCount) {
  await alert({
    type: `job_fail:${jobName}:${shopName}`,
    title: `定时任务失败 · ${jobName}`,
    detail: `店铺「${shopName}」连续失败 ${failCount} 次\n**错误：** ${errMsg}`,
    level: failCount >= 3 ? 'critical' : 'warning',
    cooldownMs: failCount >= 3 ? 30 * 60 * 1000 : 10 * 60 * 1000
  });
}

/** API 调用异常告警（拼多多 / DeepSeek 等） */
async function apiError(apiName, errMsg, errCode) {
  await alert({
    type: `api_error:${apiName}`,
    title: `API 调用异常 · ${apiName}`,
    detail: `**错误码：** ${errCode || 'N/A'}\n**错误信息：** ${errMsg}`,
    level: 'warning',
    cooldownMs: 15 * 60 * 1000
  });
}

/** 库存预警告警 */
async function stockWarning(shopName, items) {
  const itemLines = items.slice(0, 5).map(g => `- ${g.goods_name}：剩余 **${g.stock}** 件`).join('\n');
  const more = items.length > 5 ? `\n...还有 ${items.length - 5} 件` : '';
  await alert({
    type: `stock:${shopName}`,
    title: `库存预警 · ${shopName}`,
    detail: `以下商品库存不足，请及时补货：\n${itemLines}${more}`,
    level: 'warning',
    cooldownMs: 60 * 60 * 1000  // 库存告警 1 小时冷却
  });
}

/** 系统资源告警（内存、磁盘等） */
async function systemAlert(title, detail) {
  await alert({
    type: `system:${title}`,
    title: `系统告警 · ${title}`,
    detail,
    level: 'critical',
    cooldownMs: 30 * 60 * 1000
  });
}

/** DeepSeek 调用量接近上限告警 */
async function aiLimitWarning(todayCount, limit) {
  const percent = Math.round((todayCount / limit) * 100);
  await alert({
    type: 'ai_limit',
    title: 'AI 调用量预警',
    detail: `今日 DeepSeek 调用已达 **${todayCount}/${limit}** 次（${percent}%），接近上限`,
    level: percent >= 100 ? 'critical' : 'warning',
    cooldownMs: 2 * 60 * 60 * 1000
  });
}

module.exports = { alert, jobFail, apiError, stockWarning, systemAlert, aiLimitWarning };
