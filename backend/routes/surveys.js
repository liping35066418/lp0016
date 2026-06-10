const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const { readJSON, writeJSON, generateId, surveyDir, surveyIndexFile } = require('../utils/storage');

function validateSurvey(survey) {
  const errors = [];
  if (!survey.title || survey.title.trim() === '') {
    errors.push('问卷标题不能为空');
  }
  if (!survey.questions || !Array.isArray(survey.questions)) {
    errors.push('问卷必须包含问题列表');
    return errors;
  }
  const validTypes = ['radio', 'checkbox', 'text', 'rating'];
  survey.questions.forEach((q, idx) => {
    if (!q.id) errors.push(`第${idx + 1}题缺少ID`);
    if (!q.type || !validTypes.includes(q.type)) {
      errors.push(`第${idx + 1}题题型无效`);
    }
    if (!q.title || q.title.trim() === '') {
      errors.push(`第${idx + 1}题标题不能为空`);
    }
    if ((q.type === 'radio' || q.type === 'checkbox') && (!q.options || q.options.length === 0)) {
      errors.push(`第${idx + 1}题缺少选项`);
    }
    if (q.type === 'rating' && (typeof q.maxValue !== 'number' || q.maxValue < 1)) {
      errors.push(`第${idx + 1}题分值设置无效`);
    }
    if (q.type === 'text') {
      if (typeof q.minLength === 'number' && typeof q.maxLength === 'number' && q.minLength > q.maxLength) {
        errors.push(`第${idx + 1}题最小字数不能大于最大字数`);
      }
    }
    if (q.type === 'checkbox' && typeof q.minSelect === 'number' && typeof q.maxSelect === 'number') {
      if (q.minSelect > q.maxSelect) {
        errors.push(`第${idx + 1}题最少选择数不能大于最多选择数`);
      }
      if (q.options && q.maxSelect > q.options.length) {
        errors.push(`第${idx + 1}题最多选择数不能大于选项总数`);
      }
    }
  });
  return errors;
}

router.get('/', (req, res) => {
  try {
    const index = readJSON(surveyIndexFile);
    const surveys = index.surveys.sort((a, b) => b.updatedAt - a.updatedAt);
    res.json({ success: true, data: surveys });
  } catch (err) {
    logger.error(`获取问卷列表失败: ${err.message}`);
    res.status(500).json({ success: false, message: '获取问卷列表失败' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const surveyFile = path.join(surveyDir, `${id}.json`);
    if (!fs.existsSync(surveyFile)) {
      return res.status(404).json({ success: false, message: '问卷不存在' });
    }
    const survey = readJSON(surveyFile);
    res.json({ success: true, data: survey });
  } catch (err) {
    logger.error(`获取问卷详情失败: ${err.message}`);
    res.status(500).json({ success: false, message: '获取问卷详情失败' });
  }
});

router.post('/', (req, res) => {
  try {
    const surveyData = req.body;
    const errors = validateSurvey(surveyData);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: '问卷数据校验失败', errors });
    }

    const id = generateId();
    const now = Date.now();
    const accessToken = generateId();

    const survey = {
      id,
      title: surveyData.title.trim(),
      description: surveyData.description || '',
      questions: surveyData.questions.map((q, idx) => ({
        ...q,
        id: q.id || generateId(),
        order: idx,
        required: q.required !== false
      })),
      status: 'draft',
      accessLink: `http://localhost:3616/survey/${accessToken}`,
      accessToken,
      createdAt: now,
      updatedAt: now,
      publishedAt: null
    };

    writeJSON(path.join(surveyDir, `${id}.json`), survey);

    const index = readJSON(surveyIndexFile);
    index.surveys.push({
      id,
      title: survey.title,
      description: survey.description,
      status: survey.status,
      accessLink: survey.accessLink,
      accessToken: survey.accessToken,
      questionCount: survey.questions.length,
      responseCount: 0,
      createdAt: now,
      updatedAt: now,
      publishedAt: null
    });
    writeJSON(surveyIndexFile, index);

    logger.info(`创建问卷成功: ${id} - ${survey.title}`);
    res.json({ success: true, data: survey });
  } catch (err) {
    logger.error(`创建问卷失败: ${err.message}`);
    res.status(500).json({ success: false, message: '创建问卷失败' });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const surveyData = req.body;
    const surveyFile = path.join(surveyDir, `${id}.json`);

    if (!fs.existsSync(surveyFile)) {
      return res.status(404).json({ success: false, message: '问卷不存在' });
    }

    const errors = validateSurvey(surveyData);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: '问卷数据校验失败', errors });
    }

    const oldSurvey = readJSON(surveyFile);
    const now = Date.now();

    if (oldSurvey.status === 'published') {
      return res.status(400).json({ success: false, message: '已发布的问卷无法编辑，请先下架' });
    }

    const survey = {
      ...oldSurvey,
      title: surveyData.title.trim(),
      description: surveyData.description || '',
      questions: surveyData.questions.map((q, idx) => ({
        ...q,
        id: q.id || generateId(),
        order: idx,
        required: q.required !== false
      })),
      updatedAt: now
    };

    writeJSON(surveyFile, survey);

    const index = readJSON(surveyIndexFile);
    const idx = index.surveys.findIndex(s => s.id === id);
    if (idx !== -1) {
      index.surveys[idx] = {
        ...index.surveys[idx],
        title: survey.title,
        description: survey.description,
        questionCount: survey.questions.length,
        updatedAt: now
      };
      writeJSON(surveyIndexFile, index);
    }

    logger.info(`更新问卷成功: ${id}`);
    res.json({ success: true, data: survey });
  } catch (err) {
    logger.error(`更新问卷失败: ${err.message}`);
    res.status(500).json({ success: false, message: '更新问卷失败' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const surveyFile = path.join(surveyDir, `${id}.json`);

    if (!fs.existsSync(surveyFile)) {
      return res.status(404).json({ success: false, message: '问卷不存在' });
    }

    fs.unlinkSync(surveyFile);

    const index = readJSON(surveyIndexFile);
    index.surveys = index.surveys.filter(s => s.id !== id);
    writeJSON(surveyIndexFile, index);

    logger.info(`删除问卷成功: ${id}`);
    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    logger.error(`删除问卷失败: ${err.message}`);
    res.status(500).json({ success: false, message: '删除问卷失败' });
  }
});

router.post('/:id/publish', (req, res) => {
  try {
    const { id } = req.params;
    const surveyFile = path.join(surveyDir, `${id}.json`);

    if (!fs.existsSync(surveyFile)) {
      return res.status(404).json({ success: false, message: '问卷不存在' });
    }

    const survey = readJSON(surveyFile);
    if (survey.questions.length === 0) {
      return res.status(400).json({ success: false, message: '问卷至少需要一道题目' });
    }

    const now = Date.now();
    survey.status = 'published';
    survey.publishedAt = now;
    survey.updatedAt = now;
    writeJSON(surveyFile, survey);

    const index = readJSON(surveyIndexFile);
    const idx = index.surveys.findIndex(s => s.id === id);
    if (idx !== -1) {
      index.surveys[idx].status = 'published';
      index.surveys[idx].publishedAt = now;
      index.surveys[idx].updatedAt = now;
      writeJSON(surveyIndexFile, index);
    }

    logger.info(`发布问卷成功: ${id} - 访问链接: ${survey.accessLink}`);
    res.json({ success: true, data: survey, message: '发布成功' });
  } catch (err) {
    logger.error(`发布问卷失败: ${err.message}`);
    res.status(500).json({ success: false, message: '发布问卷失败' });
  }
});

router.post('/:id/unpublish', (req, res) => {
  try {
    const { id } = req.params;
    const surveyFile = path.join(surveyDir, `${id}.json`);

    if (!fs.existsSync(surveyFile)) {
      return res.status(404).json({ success: false, message: '问卷不存在' });
    }

    const survey = readJSON(surveyFile);
    const now = Date.now();
    survey.status = 'draft';
    survey.updatedAt = now;
    writeJSON(surveyFile, survey);

    const index = readJSON(surveyIndexFile);
    const idx = index.surveys.findIndex(s => s.id === id);
    if (idx !== -1) {
      index.surveys[idx].status = 'draft';
      index.surveys[idx].updatedAt = now;
      writeJSON(surveyIndexFile, index);
    }

    logger.info(`下架问卷成功: ${id}`);
    res.json({ success: true, data: survey, message: '下架成功' });
  } catch (err) {
    logger.error(`下架问卷失败: ${err.message}`);
    res.status(500).json({ success: false, message: '下架问卷失败' });
  }
});

router.get('/access/:token', (req, res) => {
  try {
    const { token } = req.params;
    const index = readJSON(surveyIndexFile);
    const meta = index.surveys.find(s => s.accessToken === token);
    
    if (!meta) {
      return res.status(404).json({ success: false, message: '问卷链接无效' });
    }
    if (meta.status !== 'published') {
      return res.status(400).json({ success: false, message: '问卷未发布或已下架' });
    }

    const surveyFile = path.join(surveyDir, `${meta.id}.json`);
    const survey = readJSON(surveyFile);
    const { questions, title, description, id } = survey;
    res.json({ success: true, data: { id, title, description, questions, accessToken: token } });
  } catch (err) {
    logger.error(`通过token获取问卷失败: ${err.message}`);
    res.status(500).json({ success: false, message: '获取问卷失败' });
  }
});

module.exports = router;
