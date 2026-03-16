'use strict';

const cron = require('node-cron');
const goodsService = require('../services/goods.service');
const shopService = require('../services/shop.service');
const logger = require('../utils/logger');

function start() {
  cron.schedule('0 * * * *', async () => {
    const shops = shopService.listShops().filter(s => s.status === 'active');
    for (const shop of shops) {
      try {
        await goodsService.checkStockWarning(shop.id);
      } catch (err) {
        logger.error(`[定时任务] 店铺「${shop.name}」库存检查失败: ${err.message}`);
      }
    }
  });
  logger.info('[定时任务] 库存检查已启动（每小时，覆盖所有活跃店铺）');
}

module.exports = { start };
