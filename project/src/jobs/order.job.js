'use strict';

const cron = require('node-cron');
const orderService = require('../services/order.service');
const shopService = require('../services/shop.service');
const monitor = require('../utils/monitor');
const logger = require('../utils/logger');

const failCounts = {};

function start() {
  cron.schedule('*/5 * * * *', async () => {
    const shops = shopService.listShops().filter(s => s.status === 'active');
    for (const shop of shops) {
      try {
        const result = await orderService.syncOrders(shop.id);
        failCounts[shop.id] = 0;
        logger.info(`[定时任务] 店铺「${shop.name}」订单同步: 新增 ${result.newCount} 条`);
      } catch (err) {
        failCounts[shop.id] = (failCounts[shop.id] || 0) + 1;
        logger.error(`[定时任务] 店铺「${shop.name}」同步失败(${failCounts[shop.id]}): ${err.message}`);
        if (failCounts[shop.id] >= 3) {
          await monitor.jobFail('订单同步', shop.name, err.message, failCounts[shop.id]);
        }
      }
    }
  });
  logger.info('[定时任务] 订单同步已启动（每 5 分钟，覆盖所有活跃店铺）');
}

module.exports = { start };
