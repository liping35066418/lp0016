const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const { readJSON, surveyDir, responseDir, responseIndexFile } = require('../utils/storage');

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

router.get('/survey/:surveyId', (req, res) => {
  try {
    const { surveyId } = req.params;
    const { startTime, endTime, filters } = req.query;

    const surveyFile = path.join(surveyDir, `${surveyId}.json`);
    if (!fs.existsSync(surveyFile)) {
      return res.status(404).json({ success: false, message: '问卷不存在' });
    }
    const survey = readJSON(surveyFile);

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
    let responseIds = rIndex.responses
      .filter(r => r.surveyId === surveyId)
      .filter(r => {
        let ok = true;
        if (startTime) ok = ok && r.submittedAt >= new Date(startTime).getTime();
        if (endTime) ok = ok && r.submittedAt < (new Date(endTime).getTime() + 86400000);
        return ok;
      })
      .map(r => r.id);

    let responses = responseIds
      .map(id => {
        const f = path.join(responseDir, `${id}.json`);
        return fs.existsSync(f) ? readJSON(f) : null;
      })
      .filter(Boolean);

    if (parsedFilters.length > 0) {
      responses = filterResponsesByConditions(responses, parsedFilters, survey);
    }

    const questionStats = survey.questions.map(q => {
      const stat = {
        questionId: q.id,
        questionTitle: q.title,
        questionType: q.type,
        totalAnswered: 0,
        skipped: 0
      };

      const answersOfQ = responses.map(r => r.answers.find(a => a.questionId === q.id))
        .filter(a => a && !isEmptyAnswer(a.value, q.type));
      stat.totalAnswered = answersOfQ.length;
      stat.skipped = responses.length - answersOfQ.length;

      switch (q.type) {
        case 'radio': {
          const counts = {};
          q.options.forEach(o => { counts[o.value] = { label: o.label, value: o.value, count: 0 }; });
          answersOfQ.forEach(a => {
            if (a.value !== undefined && a.value !== null && a.value !== '' && counts[a.value]) {
              counts[a.value].count++;
            }
          });
          stat.data = Object.values(counts);
          break;
        }
        case 'checkbox': {
          const counts = {};
          q.options.forEach(o => { counts[o.value] = { label: o.label, value: o.value, count: 0 }; });
          answersOfQ.forEach(a => {
            if (Array.isArray(a.value) && a.value.length > 0) {
              a.value.forEach(v => {
                if (counts[v]) counts[v].count++;
              });
            }
          });
          stat.data = Object.values(counts);
          break;
        }
        case 'rating': {
          const max = q.maxValue || 5;
          const dist = Array(max).fill(0).map((_, i) => ({ rating: i + 1, count: 0 }));
          let sum = 0, count = 0;
          answersOfQ.forEach(a => {
            if (typeof a.value === 'number' && a.value >= 1) {
              sum += a.value;
              count++;
              if (a.value <= max) {
                dist[a.value - 1].count++;
              }
            }
          });
          stat.data = dist;
          stat.average = count > 0 ? (sum / count).toFixed(2) : '0.00';
          break;
        }
        case 'text': {
          stat.data = answersOfQ
            .filter(a => a.value && a.value.toString().trim())
            .map(a => ({ value: a.value.toString() }));
          break;
        }
      }

      return stat;
    });

    const dailyData = {};
    responses.forEach(r => {
      const dateKey = r.submittedAtStr.substring(0, 10);
      dailyData[dateKey] = (dailyData[dateKey] || 0) + 1;
    });
    const dailyTrend = Object.keys(dailyData)
      .sort()
      .map(date => ({ date, count: dailyData[date] }));

    res.json({
      success: true,
      data: {
        surveyTitle: survey.title,
        totalResponses: responses.length,
        questionCount: survey.questions.length,
        publishedAt: survey.publishedAt,
        dailyTrend,
        questionStats
      }
    });
  } catch (err) {
    logger.error(`获取统计数据失败: ${err.message}\n${err.stack}`);
    res.status(500).json({ success: false, message: '获取统计数据失败' });
  }
});

module.exports = router;
