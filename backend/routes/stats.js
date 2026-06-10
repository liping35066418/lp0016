const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const { readJSON, surveyDir, responseDir, responseIndexFile } = require('../utils/storage');

router.get('/survey/:surveyId', (req, res) => {
  try {
    const { surveyId } = req.params;
    const { startTime, endTime } = req.query;

    const surveyFile = path.join(surveyDir, `${surveyId}.json`);
    if (!fs.existsSync(surveyFile)) {
      return res.status(404).json({ success: false, message: '问卷不存在' });
    }
    const survey = readJSON(surveyFile);

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

    const responses = responseIds
      .map(id => {
        const f = path.join(responseDir, `${id}.json`);
        return fs.existsSync(f) ? readJSON(f) : null;
      })
      .filter(Boolean);

    const questionStats = survey.questions.map(q => {
      const stat = {
        questionId: q.id,
        questionTitle: q.title,
        questionType: q.type,
        totalAnswered: 0,
        skipped: responses.length - 0
      };

      const answersOfQ = responses.map(r => r.answers.find(a => a.questionId === q.id)).filter(Boolean);
      stat.totalAnswered = answersOfQ.length;
      stat.skipped = responses.length - answersOfQ.length;

      switch (q.type) {
        case 'radio': {
          const counts = {};
          q.options.forEach(o => { counts[o.value] = { label: o.label, value: o.value, count: 0 }; });
          answersOfQ.forEach(a => {
            if (a.value !== undefined && a.value !== null && counts[a.value]) {
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
            if (Array.isArray(a.value)) {
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
            if (typeof a.value === 'number') {
              sum += a.value;
              count++;
              if (a.value >= 1 && a.value <= max) {
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
    responseIds.forEach(id => {
      const f = path.join(responseDir, `${id}.json`);
      if (fs.existsSync(f)) {
        const r = readJSON(f);
        const dateKey = r.submittedAtStr.substring(0, 10);
        dailyData[dateKey] = (dailyData[dateKey] || 0) + 1;
      }
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
