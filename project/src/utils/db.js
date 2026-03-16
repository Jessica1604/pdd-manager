'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(path.join(dbDir, 'pdd.db'));

function initDb() {
  db.exec(`
    -- 店铺表（多账号核心）
    CREATE TABLE IF NOT EXISTS shops (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      name      TEXT NOT NULL,
      client_id     TEXT NOT NULL,
      client_secret TEXT NOT NULL,
      access_token  TEXT NOT NULL,
      status    TEXT DEFAULT 'active',   -- active | disabled
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 商品表（加 shop_id）
    CREATE TABLE IF NOT EXISTS goods (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id  INTEGER NOT NULL DEFAULT 0,
      goods_id TEXT NOT NULL,
      goods_name TEXT,
      price    REAL,
      stock    INTEGER,
      status   TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(shop_id, goods_id)
    );

    -- 订单表（加 shop_id）
    CREATE TABLE IF NOT EXISTS orders (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id     INTEGER NOT NULL DEFAULT 0,
      order_sn    TEXT NOT NULL,
      buyer_name  TEXT,
      buyer_phone TEXT,
      buyer_address TEXT,
      goods_info  TEXT,
      total_amount REAL,
      status      TEXT,
      tracking_number TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(shop_id, order_sn)
    );

    -- 客服消息表（加 shop_id）
    CREATE TABLE IF NOT EXISTS customer_messages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id    INTEGER NOT NULL DEFAULT 0,
      user_id    TEXT,
      message    TEXT,
      reply      TEXT,
      reply_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 全局配置表
    CREATE TABLE IF NOT EXISTS config (
      key   TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 迁移：旧表若无 shop_id 列则补加（兼容已有数据）
  const tables = ['goods', 'orders', 'customer_messages'];
  for (const t of tables) {
    const cols = db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name);
    if (!cols.includes('shop_id')) {
      db.exec(`ALTER TABLE ${t} ADD COLUMN shop_id INTEGER NOT NULL DEFAULT 0`);
    }
  }

  console.log('Database initialized.');
}

initDb();

module.exports = db;
