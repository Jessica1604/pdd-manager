'use strict';

/**
 * 库存检查定时任务：每 1 小时检查一次低库存商品
 */

const cron = require('node-cron');
const goodsService = require('../services/goods.service');
const logger = require('../utils/logger');

function start() {
  cron.schedule('0 * * * *', async () => {
    try {
      const lowStock = await goodsService.checkStockWarning();
      if (lowStock?.length) {
        logger.warn(`[定时任务] 库存预警：${lowStock.length} 件商品不足`);
      }
    } catch (err) {
      logger.error(`[定时任务] 库存检查失败: ${err.message}`);
    }
  });
  logger.info('[定时任务] 库存检查已启动（每小时）');
}

module.exports = { start };
