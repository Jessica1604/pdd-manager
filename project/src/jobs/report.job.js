'use strict';

/**
 * 报表定时任务
 * - 每天 00:00 生成昨日日报（所有活跃店铺）
 * - 每周一 09:00 生成上周周报
 */

const cron = require('node-cron');
const analyticsService = require('../services/analytics.service');
const shopService = require('../services/shop.service');
const feishu = require('../utils/feishu');
const logger = require('../utils/logger');

function start() {
  // 每日日报：00:00
  cron.schedule('0 0 * * *', async () => {
    logger.info('[定时任务] 开始生成每日日报...');
    const shops = shopService.listShops().filter(s => s.status === 'active');
    for (const shop of shops) {
      try {
        await analyticsService.sendDailyReport(shop.id, shop.name);
      } catch (err) {
        logger.error(`[日报] 店铺「${shop.name}」失败: ${err.message}`);
        await feishu.notifyAlert('日报生成失败', `店铺「${shop.name}」: ${err.message}`);
      }
    }
  });

  // 每周周报：周一 09:00
  cron.schedule('0 9 * * 1', async () => {
    logger.info('[定时任务] 开始生成每周周报...');
    const shops = shopService.listShops().filter(s => s.status === 'active');
    for (const shop of shops) {
      try {
        await analyticsService.sendWeeklyReport(shop.id, shop.name);
      } catch (err) {
        logger.error(`[周报] 店铺「${shop.name}」失败: ${err.message}`);
      }
    }
  });

  logger.info('[定时任务] 报表任务已启动（日报 00:00 / 周报 周一 09:00）');
}

module.exports = { start };
