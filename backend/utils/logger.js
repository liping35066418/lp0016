const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '..', 'storage', 'logs');
const logFile = path.join(logsDir, 'app.log');
const errorFile = path.join(logsDir, 'error.log');

function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(0, 19);
}

function writeLog(level, message) {
  const timestamp = getTimestamp();
  const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
  
  try {
    fs.appendFileSync(logFile, logLine);
    if (level === 'error') {
      fs.appendFileSync(errorFile, logLine);
    }
  } catch (err) {
    console.error('写入日志失败:', err);
  }
}

module.exports = {
  info: (msg) => {
    console.log(`[INFO] ${msg}`);
    writeLog('info', msg);
  },
  warn: (msg) => {
    console.warn(`[WARN] ${msg}`);
    writeLog('warn', msg);
  },
  error: (msg) => {
    console.error(`[ERROR] ${msg}`);
    writeLog('error', msg);
  },
  debug: (msg) => {
    console.log(`[DEBUG] ${msg}`);
    writeLog('debug', msg);
  }
};
