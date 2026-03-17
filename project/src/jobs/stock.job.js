'use strict';

const cron = require('node-cron');
const goodsService = require('../services/goods.service');
const shopService = require('../services/shop.service');
const monitor = require('../utils/monitor');
const logger = require('../utils/logger');

const failCounts = {};

function start() {
  cron.schedule('0 * * * *', async () => {
    const shops = shopService.listShops().filter(s => s.status === 'active');
    for (const shop of shops) {
      try {
        const lowStock = await goodsService.checkStockWarning(shop.id);
        if (lowStock.length > 0) {
          await monitor.stockWarning(shop.name, lowStock);
        }
        failCounts[shop.id] = 0;
      } catch (err) {
        failCounts[shop.id] = (failCounts[shop.id] || 0) + 1;
        logger.error(`[定时任务] 店铺「${shop.name}」库存检查失败: ${err.message}`);
        if (failCounts[shop.id] >= 3) {
          await monitor.jobFail('库存检查', shop.name, err.message, failCounts[shop.id]);
        }
      }
    }
  });
  logger.info('[定时任务] 库存检查已启动（每小时，覆盖所有活跃店铺）');
}

module.exports = { start };
