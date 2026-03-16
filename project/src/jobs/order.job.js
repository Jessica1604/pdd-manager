'use strict';

/**
 * 订单同步定时任务：每 5 分钟拉取一次待发货订单
 */

const cron = require('node-cron');
const orderService = require('../services/order.service');
const feishu = require('../utils/feishu');
const logger = require('../utils/logger');

let failCount = 0;
const MAX_FAIL = 3;

function start() {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const result = await orderService.syncOrders();
      failCount = 0;
      logger.info(`[定时任务] 订单同步完成: 新增 ${result.newCount} 条`);
    } catch (err) {
      failCount++;
      logger.error(`[定时任务] 订单同步失败 (${failCount}/${MAX_FAIL}): ${err.message}`);
      if (failCount >= MAX_FAIL) {
        await feishu.sendMessage(`🚨 系统告警\n订单同步连续失败 ${MAX_FAIL} 次\n错误：${err.message}`);
        failCount = 0;
      }
    }
  });
  logger.info('[定时任务] 订单同步已启动（每 5 分钟）');
}

module.exports = { start };
