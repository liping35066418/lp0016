const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
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

router.get('/survey/:surveyId', (req, res) => {
  try {
    const { surveyId } = req.params;
    const { format = 'xlsx', startTime, endTime } = req.query;

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
      .sort((a, b) => a.submittedAt - b.submittedAt)
      .map(r => r.id);

    const responses = responseIds
      .map(id => {
        const f = path.join(responseDir, `${id}.json`);
        return fs.existsSync(f) ? readJSON(f) : null;
      })
      .filter(Boolean);

    const headerRow = ['序号', '提交时间'];
    survey.questions.forEach((q, idx) => {
      const typeMap = { radio: '单选', checkbox: '多选', text: '填空', rating: '评分' };
      headerRow.push(`Q${idx + 1}.${q.title}【${typeMap[q.type]}】`);
    });

    const dataRows = responses.map((resp, rowIdx) => {
      const row = [rowIdx + 1, resp.submittedAtStr];
      survey.questions.forEach(q => {
        const answer = resp.answers.find(a => a.questionId === q.id);
        let display = '';
        if (answer && !isEmptyAnswer(answer.value, q.type)) {
          switch (q.type) {
            case 'radio': {
              const opt = (q.options || []).find(o => o.value === answer.value);
              display = opt ? opt.label : (answer.value !== undefined ? String(answer.value) : '');
              break;
            }
            case 'checkbox': {
              if (Array.isArray(answer.value)) {
                display = answer.value.map(v => {
                  const opt = (q.options || []).find(o => o.value === v);
                  return opt ? opt.label : String(v);
                }).join('、');
              }
              break;
            }
            case 'rating': {
              display = typeof answer.value === 'number' ? `${answer.value}分` : '';
              break;
            }
            case 'text': {
              display = answer.value ? String(answer.value) : '';
              break;
            }
          }
        }
        row.push(display);
      });
      return row;
    });

    const aoa = [headerRow, ...dataRows];

    const statHeader = ['统计指标', '值'];
    const statRows = [
      ['问卷标题', survey.title],
      ['问卷描述', survey.description || '-'],
      ['总题目数', survey.questions.length],
      ['总答卷数', responses.length],
      ['发布时间', survey.publishedAt ? new Date(survey.publishedAt).toISOString().replace('T', ' ').substring(0, 19) : '-']
    ];
    const statAoa = [statHeader, ...statRows];

    if (format === 'csv') {
      const csvLines = aoa.map(row => 
        row.map(cell => {
          const str = String(cell || '').replace(/"/g, '""');
          return /[,"\n]/.test(str) ? `"${str}"` : str;
        }).join(',')
      );
      const csvContent = '\ufeff' + csvLines.join('\n');
      const filename = `问卷报表_${survey.title}_${Date.now()}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      res.send(csvContent);
      logger.info(`导出CSV报表: 问卷${surveyId}, ${responses.length}条答卷`);
    } else {
      const wb = XLSX.utils.book_new();
      const wsData = XLSX.utils.aoa_to_sheet(aoa);
      XLSX.utils.book_append_sheet(wb, wsData, '答卷明细');
      const wsStat = XLSX.utils.aoa_to_sheet(statAoa);
      XLSX.utils.book_append_sheet(wb, wsStat, '问卷概览');

      survey.questions.forEach((q, idx) => {
        if (q.type === 'radio' || q.type === 'checkbox' || q.type === 'rating') {
          const counts = {};
          if (q.type === 'rating') {
            const max = q.maxValue || 5;
            for (let i = 1; i <= max; i++) counts[i] = { label: `${i}分`, count: 0 };
            responses.forEach(r => {
              const a = r.answers.find(an => an.questionId === q.id);
              if (a && !isEmptyAnswer(a.value, q.type) && typeof a.value === 'number' && counts[a.value]) counts[a.value].count++;
            });
          } else {
            q.options.forEach(o => { counts[o.value] = { label: o.label, count: 0 }; });
            responses.forEach(r => {
              const a = r.answers.find(an => an.questionId === q.id);
              if (a && !isEmptyAnswer(a.value, q.type)) {
                if (q.type === 'radio' && counts[a.value]) counts[a.value].count++;
                if (q.type === 'checkbox' && Array.isArray(a.value) && a.value.length > 0) {
                  a.value.forEach(v => { if (counts[v]) counts[v].count++; });
                }
              }
            });
          }
          const qAoa = [['选项', '选择次数', '占比']];
          const total = Object.values(counts).reduce((s, c) => s + c.count, 0) || 1;
          Object.values(counts).forEach(c => {
            qAoa.push([c.label, c.count, ((c.count / total) * 100).toFixed(2) + '%']);
          });
          const qWs = XLSX.utils.aoa_to_sheet(qAoa);
          XLSX.utils.book_append_sheet(wb, qWs, `Q${idx + 1}统计`);
        }
      });

      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const filename = `问卷报表_${survey.title}_${Date.now()}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      res.send(buf);
      logger.info(`导出Excel报表: 问卷${surveyId}, ${responses.length}条答卷`);
    }
  } catch (err) {
    logger.error(`导出报表失败: ${err.message}\n${err.stack}`);
    res.status(500).json({ success: false, message: '导出报表失败' });
  }
});

module.exports = router;
