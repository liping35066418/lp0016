const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const { readJSON, writeJSON, generateId, surveyDir, responseDir, responseIndexFile, surveyIndexFile } = require('../utils/storage');

function isEmptyAnswer(value, type) {
  if (value === null || value === undefined) return true;
  if (type === 'text' && String(value).trim() === '') return true;
  if (type === 'radio' && (value === '' || value === null || value === undefined)) return true;
  if (type === 'checkbox' && (!Array.isArray(value) || value.length === 0)) return true;
  if (type === 'rating' && (typeof value !== 'number' || value < 1)) return true;
  return false;
}

function filterResponsesByConditions(responses, filters, survey) {
  if (!filters || filters.length === 0) return responses;
  const questionMap = {};
  (survey?.questions || []).forEach(q => { questionMap[q.id] = q; });
  return responses.filter(resp => {
    return filters.every(f => {
      const answer = resp.answers.find(a => a.questionId === f.questionId);
      if (!answer) return false;
      const q = questionMap[f.questionId];
      const qType = q?.type;
      if (qType === 'radio') {
        return answer.value === f.optionValue;
      }
      if (qType === 'checkbox') {
        return Array.isArray(answer.value) && answer.value.includes(f.optionValue);
      }
      return false;
    });
  });
}

function validateResponse(survey, answers) {
  const errors = [];
  const answerMap = {};
  answers.forEach(a => { answerMap[a.questionId] = a; });

  survey.questions.forEach((q, idx) => {
    const answer = answerMap[q.id];
    const questionNo = `第${idx + 1}题`;

    if (q.required) {
      if (!answer || isEmptyAnswer(answer.value, q.type)) {
        errors.push(`${questionNo}为必填项`);
        return;
      }
    }

    if (!answer || isEmptyAnswer(answer.value, q.type)) return;

    switch (q.type) {
      case 'text': {
        const val = answer.value ? answer.value.toString() : '';
        if (val.length > 0) {
          if (typeof q.minLength === 'number' && val.length < q.minLength) {
            errors.push(`${questionNo}至少需要${q.minLength}个字`);
          }
          if (typeof q.maxLength === 'number' && val.length > q.maxLength) {
            errors.push(`${questionNo}最多允许${q.maxLength}个字`);
          }
        }
        break;
      }
      case 'radio': {
        if (q.options && answer.value !== undefined && answer.value !== null && answer.value !== '') {
          const valid = q.options.some(o => o.value === answer.value);
          if (!valid) errors.push(`${questionNo}选项无效`);
        }
        break;
      }
      case 'checkbox': {
        if (Array.isArray(answer.value) && answer.value.length > 0) {
          if (typeof q.minSelect === 'number' && answer.value.length < q.minSelect) {
            errors.push(`${questionNo}至少选择${q.minSelect}项`);
          }
          if (typeof q.maxSelect === 'number' && answer.value.length > q.maxSelect) {
            errors.push(`${questionNo}最多选择${q.maxSelect}项`);
          }
          if (q.options) {
            const allValid = answer.value.every(v => q.options.some(o => o.value === v));
            if (!allValid) errors.push(`${questionNo}选项无效`);
          }
        }
        break;
      }
      case 'rating': {
        if (typeof answer.value === 'number' && answer.value >= 1) {
          const max = q.maxValue || 5;
          if (answer.value > max) {
            errors.push(`${questionNo}分值必须在1-${max}之间`);
          }
        }
        break;
      }
    }
  });

  return errors;
}

router.post('/', (req, res) => {
  try {
    const { surveyId, accessToken, answers, userInfo } = req.body;

    if (!surveyId && !accessToken) {
      return res.status(400).json({ success: false, message: '缺少问卷标识' });
    }

    let targetSurveyId = surveyId;
    if (accessToken && !surveyId) {
      const sIndex = readJSON(surveyIndexFile);
      const meta = sIndex.surveys.find(s => s.accessToken === accessToken);
      if (!meta) {
        return res.status(404).json({ success: false, message: '问卷链接无效' });
      }
      targetSurveyId = meta.id;
    }

    const surveyFile = path.join(surveyDir, `${targetSurveyId}.json`);
    if (!fs.existsSync(surveyFile)) {
      return res.status(404).json({ success: false, message: '问卷不存在' });
    }

    const survey = readJSON(surveyFile);
    if (survey.status !== 'published') {
      return res.status(400).json({ success: false, message: '问卷未发布或已下架' });
    }

    const validationErrors = validateResponse(survey, answers || []);
    if (validationErrors.length > 0) {
      return res.status(400).json({ success: false, message: '作答数据校验失败', errors: validationErrors });
    }

    const now = Date.now();
    const responseId = generateId();

    const response = {
      id: responseId,
      surveyId: targetSurveyId,
      accessToken: accessToken || survey.accessToken,
      answers: answers || [],
      userInfo: userInfo || {
        ip: req.ip,
        userAgent: req.headers['user-agent'] || ''
      },
      submittedAt: now,
      submittedAtStr: new Date(now).toISOString().replace('T', ' ').substring(0, 19)
    };

    writeJSON(path.join(responseDir, `${responseId}.json`), response);

    const rIndex = readJSON(responseIndexFile);
    rIndex.responses.push({
      id: responseId,
      surveyId: targetSurveyId,
      submittedAt: now,
      submittedAtStr: response.submittedAtStr
    });
    writeJSON(responseIndexFile, rIndex);

    const sIndex = readJSON(surveyIndexFile);
    const sIdx = sIndex.surveys.findIndex(s => s.id === targetSurveyId);
    if (sIdx !== -1) {
      sIndex.surveys[sIdx].responseCount = (sIndex.surveys[sIdx].responseCount || 0) + 1;
      sIndex.surveys[sIdx].updatedAt = now;
      writeJSON(surveyIndexFile, sIndex);
    }

    logger.info(`提交答卷成功: 问卷${targetSurveyId}, 答卷${responseId}`);
    res.json({ 
      success: true, 
      message: '提交成功，感谢您的作答！',
      data: { responseId, submittedAt: response.submittedAtStr }
    });
  } catch (err) {
    logger.error(`提交答卷失败: ${err.message}\n${err.stack}`);
    res.status(500).json({ success: false, message: '提交失败，请稍后重试' });
  }
});

router.get('/survey/:surveyId', (req, res) => {
  try {
    const { surveyId } = req.params;
    const { startTime, endTime, filters, page = 1, pageSize = 20 } = req.query;

    let parsedFilters = [];
    if (filters) {
      try {
        parsedFilters = JSON.parse(filters);
        if (!Array.isArray(parsedFilters)) parsedFilters = [];
      } catch (e) {
        parsedFilters = [];
      }
    }

    const rIndex = readJSON(responseIndexFile);
    let list = rIndex.responses.filter(r => r.surveyId === surveyId);

    if (startTime) {
      const st = new Date(startTime).getTime();
      list = list.filter(r => r.submittedAt >= st);
    }
    if (endTime) {
      const et = new Date(endTime).getTime() + 86400000;
      list = list.filter(r => r.submittedAt < et);
    }

    list.sort((a, b) => b.submittedAt - a.submittedAt);

    let allResponses = list.map(meta => {
      const file = path.join(responseDir, `${meta.id}.json`);
      if (fs.existsSync(file)) {
        return readJSON(file);
      }
      return null;
    }).filter(Boolean);

    if (parsedFilters.length > 0) {
      const surveyFile = path.join(surveyDir, `${surveyId}.json`);
      let survey = null;
      if (fs.existsSync(surveyFile)) {
        survey = readJSON(surveyFile);
      }
      allResponses = filterResponsesByConditions(allResponses, parsedFilters, survey);
    }

    const total = allResponses.length;
    const start = (parseInt(page) - 1) * parseInt(pageSize);
    const paged = allResponses.slice(start, start + parseInt(pageSize));

    res.json({
      success: true,
      data: {
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        list: paged
      }
    });
  } catch (err) {
    logger.error(`获取答卷列表失败: ${err.message}`);
    res.status(500).json({ success: false, message: '获取答卷列表失败' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const responseFile = path.join(responseDir, `${id}.json`);
    if (!fs.existsSync(responseFile)) {
      return res.status(404).json({ success: false, message: '答卷不存在' });
    }
    const data = readJSON(responseFile);
    const surveyFile = path.join(surveyDir, `${data.surveyId}.json`);
    if (fs.existsSync(surveyFile)) {
      const survey = readJSON(surveyFile);
      data.surveyTitle = survey.title;
      data.questions = survey.questions;
    }
    res.json({ success: true, data });
  } catch (err) {
    logger.error(`获取答卷详情失败: ${err.message}`);
    res.status(500).json({ success: false, message: '获取答卷详情失败' });
  }
});

module.exports = router;
