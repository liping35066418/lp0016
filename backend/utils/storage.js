const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const surveyDir = path.join(__dirname, '..', 'storage', 'surveys');
const responseDir = path.join(__dirname, '..', 'storage', 'responses');
const surveyIndexFile = path.join(surveyDir, '_index.json');
const responseIndexFile = path.join(responseDir, '_index.json');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

ensureDir(path.join(__dirname, '..', 'storage'));
ensureDir(path.join(__dirname, '..', 'storage', 'logs'));
ensureDir(surveyDir);
ensureDir(responseDir);

function ensureIndexFile(filePath, defaultContent) {
  ensureDir(path.dirname(filePath));
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultContent, null, 2));
  }
}

ensureIndexFile(surveyIndexFile, { surveys: [] });
ensureIndexFile(responseIndexFile, { responses: [] });

function readJSON(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    return null;
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function generateId() {
  return uuidv4().replace(/-/g, '').substring(0, 16);
}

module.exports = {
  readJSON,
  writeJSON,
  generateId,
  surveyDir,
  responseDir,
  surveyIndexFile,
  responseIndexFile,
  ensureIndexFile
};
