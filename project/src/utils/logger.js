'use strict';

/**
 * 日志系统 v2
 * - 按天自动轮转：logs/app-YYYY-MM-DD.log / error-YYYY-MM-DD.log / access-YYYY-MM-DD.log
 * - 异步写文件（WriteStream，不阻塞主线程）
 * - 日志级别：DEBUG < INFO < WARN < ERROR（通过 LOG_LEVEL 环境变量控制）
 * - 关键操作写入 DB config 表（供系统设置页查看）
 * - 自动清理 30 天前的日志文件
 */

const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

// 日志级别
const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const MIN_LEVEL = LEVELS[(process.env.LOG_LEVEL || 'INFO').toUpperCase()] ?? LEVELS.INFO;

// WriteStream 缓存（按日期 + 类型）
const streams = {};

function getStream(type) {
  const date = new Date().toISOString().slice(0, 10);
  const key = `${type}-${date}`;
  if (!streams[key]) {
    const file = path.join(logDir, `${type}-${date}.log`);
    streams[key] = fs.createWriteStream(file, { flags: 'a', encoding: 'utf8' });
    // 清理旧 stream（防止文件句柄泄漏）
    for (const k of Object.keys(streams)) {
      if (k !== key && k.startsWith(`${type}-`)) {
        streams[k].end();
        delete streams[k];
      }
    }
  }
  return streams[key];
}

function format(level, msg, meta = '') {
  const ts = new Date().toISOString();
  return meta
    ? `[${ts}] [${level.padEnd(5)}] ${msg} ${meta}\n`
    : `[${ts}] [${level.padEnd(5)}] ${msg}\n`;
}

function write(type, line) {
  getStream(type).write(line);
}

// 懒加载 db，避免循环依赖
let _db = null;
function getDb() {
  if (!_db) {
    try { _db = require('./db'); } catch {}
  }
  return _db;
}

/**
 * 将关键操作写入 DB（供系统设置页日志查看）
 * @param {string} action  操作名称
 * @param {string} detail  详情
 * @param {'success'|'error'} status
 */
function writeDbLog(action, detail, status = 'success') {
  try {
    const db = getDb();
    if (!db) return;
    const key = `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    db.prepare(`
      INSERT INTO config (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP
    `).run(key, JSON.stringify({ action, detail, status }));
  } catch {}
}

const logger = {
  debug(msg) {
    if (MIN_LEVEL > LEVELS.DEBUG) return;
    const line = format('DEBUG', msg);
    process.stdout.write(line);
    write('app', line);
  },

  info(msg) {
    if (MIN_LEVEL > LEVELS.INFO) return;
    const line = format('INFO', msg);
    process.stdout.write(line);
    write('app', line);
  },

  warn(msg) {
    if (MIN_LEVEL > LEVELS.WARN) return;
    const line = format('WARN', msg);
    process.stderr.write(line);
    write('app', line);
  },

  error(msg) {
    if (MIN_LEVEL > LEVELS.ERROR) return;
    const line = format('ERROR', msg);
    process.stderr.write(line);
    write('app', line);
    write('error', line);  // 错误单独写 error 日志
  },

  /**
   * 记录 HTTP 访问日志（写 access 文件）
   */
  access(method, path, status, ms) {
    const line = format('ACCESS', `${method} ${path} ${status} ${ms}ms`);
    write('access', line);
  },

  /**
   * 记录关键业务操作（写 app 日志 + DB）
   * @param {string} action  如 '订单同步'、'手动发货'
   * @param {string} detail
   * @param {'success'|'error'} status
   */
  op(action, detail, status = 'success') {
    const line = format(status === 'success' ? 'INFO' : 'ERROR', `[OP] ${action}: ${detail}`);
    process.stdout.write(line);
    write('app', line);
    writeDbLog(action, detail, status);
  }
};

// ── 日志清理（保留最近 30 天）────────────────────────────────────────────────
function cleanOldLogs(retainDays = 30) {
  try {
    const cutoff = Date.now() - retainDays * 86400000;
    const files = fs.readdirSync(logDir);
    let cleaned = 0;
    for (const file of files) {
      if (!/\d{4}-\d{2}-\d{2}\.log$/.test(file)) continue;
      const dateStr = file.match(/(\d{4}-\d{2}-\d{2})\.log$/)?.[1];
      if (dateStr && new Date(dateStr).getTime() < cutoff) {
        fs.unlinkSync(path.join(logDir, file));
        cleaned++;
      }
    }
    if (cleaned > 0) logger.info(`[日志清理] 删除 ${cleaned} 个过期日志文件`);
  } catch (err) {
    logger.warn(`[日志清理] 失败: ${err.message}`);
  }
}

// 启动时清理一次，之后每天凌晨 1 点清理
cleanOldLogs();
const now = new Date();
const msToNextClean = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 1, 0, 0) - now;
setTimeout(() => {
  cleanOldLogs();
  setInterval(cleanOldLogs, 24 * 60 * 60 * 1000);
}, msToNextClean);

module.exports = logger;
