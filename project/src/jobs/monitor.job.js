'use strict';

/**
 * 系统资源监控任务
 * - 每 5 分钟检查内存使用率，超过 85% 告警
 * - 每天检查日志目录磁盘占用
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const monitor = require('../utils/monitor');
const logger = require('../utils/logger');

function getMemUsagePercent() {
  const total = os.totalmem();
  const free = os.freemem();
  return Math.round(((total - free) / total) * 100);
}

function getLogDirSizeMB() {
  const logDir = path.join(__dirname, '../../logs');
  try {
    const files = fs.readdirSync(logDir);
    const totalBytes = files.reduce((sum, f) => {
      try { return sum + fs.statSync(path.join(logDir, f)).size; } catch { return sum; }
    }, 0);
    return (totalBytes / 1024 / 1024).toFixed(1);
  } catch { return 0; }
}

function start() {
  // 每 5 分钟检查内存
  cron.schedule('*/5 * * * *', async () => {
    const memPercent = getMemUsagePercent();
    if (memPercent >= 85) {
      await monitor.systemAlert(
        '内存使用率过高',
        `当前内存使用率 **${memPercent}%**，请检查服务状态`
      );
    }
  });

  // 每天 02:00 检查日志目录大小
  cron.schedule('0 2 * * *', async () => {
    const sizeMB = getLogDirSizeMB();
    if (sizeMB > 500) {
      await monitor.systemAlert(
        '日志目录占用过大',
        `日志目录已占用 **${sizeMB} MB**，建议清理`
      );
    }
    logger.info(`[系统监控] 日志目录占用: ${sizeMB} MB，内存使用率: ${getMemUsagePercent()}%`);
  });

  logger.info('[系统监控] 资源监控已启动（内存每5分钟 / 磁盘每天02:00）');
}

module.exports = { start };
