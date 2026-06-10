const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const surveyRoutes = require('./routes/surveys');
const responseRoutes = require('./routes/responses');
const statsRoutes = require('./routes/stats');
const exportRoutes = require('./routes/export');
const logger = require('./utils/logger');

const app = express();
const PORT = 8616;

const storageDir = path.join(__dirname, 'storage');
const logsDir = path.join(__dirname, 'storage', 'logs');
const surveyDir = path.join(__dirname, 'storage', 'surveys');
const responseDir = path.join(__dirname, 'storage', 'responses');

if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
if (!fs.existsSync(surveyDir)) fs.mkdirSync(surveyDir, { recursive: true });
if (!fs.existsSync(responseDir)) fs.mkdirSync(responseDir, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  logger.info(`[${req.method}] ${req.url} - IP: ${req.ip}`);
  next();
});

app.use('/api/surveys', surveyRoutes);
app.use('/api/responses', responseRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/export', exportRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '问卷平台后端服务运行正常', port: PORT });
});

app.use((err, req, res, next) => {
  logger.error(`服务器错误: ${err.message}\n${err.stack}`);
  res.status(500).json({ error: '服务器内部错误', message: err.message });
});

app.listen(PORT, () => {
  logger.info(`问卷平台后端服务已启动: http://localhost:${PORT}`);
  console.log(`问卷平台后端服务已启动: http://localhost:${PORT}`);
});
