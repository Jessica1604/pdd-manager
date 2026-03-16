'use strict';

const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const logFile = path.join(logDir, 'app.log');

function format(level, msg) {
  return `[${new Date().toISOString()}] [${level}] ${msg}`;
}

function write(line) {
  fs.appendFileSync(logFile, line + '\n');
}

const logger = {
  info(msg)  { const l = format('INFO',  msg); console.log(l);   write(l); },
  warn(msg)  { const l = format('WARN',  msg); console.warn(l);  write(l); },
  error(msg) { const l = format('ERROR', msg); console.error(l); write(l); },
};

module.exports = logger;
