'use strict';

const cron = require('node-cron');
const analyticsService = require('../services/analytics.service');
const shopService = require('../services/shop.service');
const monitor = require('../utils/monitor');
const logger = require('../utils/logger');

const failCounts = {};

function start() {
  // 每日日报：00:00
  cron.schedule('0 0 * * *', async () => {
    logger.info('[定时任务] 开始生成每日日报...');
    const shops = shopService.listShops().filter(s => s.status === 'active');
    for (const shop of shops) {
      try {
        await analyticsService.sendDailyReport(shop.id, shop.name);
        failCounts[`daily_${shop.id}`] = 0;
      } catch (err) {
        failCounts[`daily_${shop.id}`] = (failCounts[`daily_${shop.id}`] || 0) + 1;
        logger.error(`[日报] 店铺「${shop.name}」失败: ${err.message}`);
        await monitor.jobFail('日报生成', shop.name, err.message, failCounts[`daily_${shop.id}`]);
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
        failCounts[`weekly_${shop.id}`] = 0;
      } catch (err) {
        failCounts[`weekly_${shop.id}`] = (failCounts[`weekly_${shop.id}`] || 0) + 1;
        logger.error(`[周报] 店铺「${shop.name}」失败: ${err.message}`);
        await monitor.jobFail('周报生成', shop.name, err.message, failCounts[`weekly_${shop.id}`]);
      }
    }
  });

  logger.info('[定时任务] 报表任务已启动（日报 00:00 / 周报 周一 09:00）');
}

module.exports = { start };
