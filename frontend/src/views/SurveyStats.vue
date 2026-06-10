<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 style="font-size:24px; font-weight:700; margin-bottom:4px;">问卷统计</h1>
        <p style="color:#6b7280;" v-if="surveyTitle">{{ surveyTitle }}</p>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-secondary" @click="$router.push('/')">返回列表</button>
        <button class="btn btn-secondary" @click="exportReport('xlsx')">📥 导出Excel</button>
        <button class="btn btn-secondary" @click="exportReport('csv')">📥 导出CSV</button>
      </div>
    </div>

    <div v-if="loading" class="empty-state page-container">
      <div class="empty-state-icon">⏳</div>
      <p>加载统计数据中...</p>
    </div>

    <div v-else-if="statsData" class="flex" style="gap:24px; align-items:flex-start; flex-wrap:wrap;">
      <div style="flex:1; min-width:280px;">
        <div class="page-container mb-6">
          <div class="flex justify-between items-center mb-4">
            <h2 style="font-size:18px; font-weight:600;">时间筛选</h2>
            <button class="btn btn-sm btn-secondary" @click="clearFilter">清除筛选</button>
          </div>
          <div class="flex gap-3">
            <div style="flex:1;">
              <label class="form-label" style="font-size:13px;">开始日期</label>
              <input type="date" v-model="startTime" @change="loadStats"/>
            </div>
            <div style="flex:1;">
              <label class="form-label" style="font-size:13px;">结束日期</label>
              <input type="date" v-model="endTime" @change="loadStats"/>
            </div>
          </div>
        </div>

        <div class="page-container mb-6">
          <h2 style="font-size:18px; font-weight:600; margin-bottom:16px;">概览数据</h2>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:12px;">
            <div class="stat-card" style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:white;">
              <div class="stat-label">答卷总数</div>
              <div class="stat-value">{{ statsData.totalResponses }}</div>
            </div>
            <div class="stat-card" style="background:linear-gradient(135deg, #10b981 0%, #059669 100%); color:white;">
              <div class="stat-label">题目数量</div>
              <div class="stat-value">{{ statsData.questionCount }}</div>
            </div>
            <div class="stat-card" style="background:linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color:white;">
              <div class="stat-label">平均题数/份</div>
              <div class="stat-value">{{ avgAnswered }}</div>
            </div>
            <div class="stat-card" style="background:linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color:white;">
              <div class="stat-label">发布时间</div>
              <div class="stat-value small" style="font-size:12px;">{{ formatDate(statsData.publishedAt) }}</div>
            </div>
          </div>
        </div>

        <div class="page-container mb-6">
          <h2 style="font-size:18px; font-weight:600; margin-bottom:16px;">答卷趋势</h2>
          <div v-if="statsData.dailyTrend && statsData.dailyTrend.length" ref="trendChartRef" style="height:280px;"></div>
          <div v-else class="empty-state" style="padding:40px;">暂无数据</div>
        </div>

        <div class="page-container">
          <div class="flex justify-between items-center mb-4">
            <h2 style="font-size:18px; font-weight:600;">答卷列表（{{ responseList.total }}份）</h2>
          </div>
          <div v-if="responseList.list && responseList.list.length" style="max-height:520px; overflow-y:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:13px;">
              <thead style="position:sticky; top:0; background:#f9fafb;">
                <tr style="border-bottom:2px solid #e5e7eb;">
                  <th style="text-align:left; padding:10px 8px;">序号</th>
                  <th style="text-align:left; padding:10px 8px;">提交时间</th>
                  <th style="text-align:right; padding:10px 8px;">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(r, i) in responseList.list" :key="r.id" style="border-bottom:1px solid #f3f4f6;">
                  <td style="padding:10px 8px;">{{ (responsePage - 1) * responsePageSize + i + 1 }}</td>
                  <td style="padding:10px 8px; color:#6b7280;">{{ r.submittedAtStr }}</td>
                  <td style="padding:10px 8px; text-align:right;">
                    <button class="btn btn-sm btn-primary" @click="viewResponse(r.id)">查看详情</button>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-if="responseList.total > responsePageSize" class="flex justify-between items-center mt-4">
              <span style="font-size:13px; color:#6b7280;">共 {{ responseList.total }} 条</span>
              <div class="flex gap-2">
                <button class="btn btn-sm btn-secondary" :disabled="responsePage <= 1" @click="changeResponsePage(-1)">上一页</button>
                <span style="padding:6px 12px; font-size:13px;">{{ responsePage }} / {{ totalResponsePages }}</span>
                <button class="btn btn-sm btn-secondary" :disabled="responsePage >= totalResponsePages" @click="changeResponsePage(1)">下一页</button>
              </div>
            </div>
          </div>
          <div v-else class="empty-state" style="padding:40px;">暂无答卷</div>
        </div>
      </div>

      <div style="flex:1.2; min-width:340px;">
        <div class="page-container">
          <h2 style="font-size:18px; font-weight:600; margin-bottom:16px;">题目统计详情</h2>
          <div v-if="statsData.questionStats && statsData.questionStats.length" style="display:flex; flex-direction:column; gap:24px;">
            <div v-for="(qs, qIdx) in statsData.questionStats" :key="qs.questionId" class="question-stat-card">
              <div style="margin-bottom:12px;">
                <div class="flex items-center gap-2 mb-1">
                  <span style="background:#667eea; color:white; padding:2px 10px; border-radius:6px; font-size:13px; font-weight:600;">Q{{ qIdx + 1 }}</span>
                  <span class="tag" :class="getTypeTagClass(qs.questionType)">{{ getTypeLabel(qs.questionType) }}</span>
                  <span style="font-size:12px; color:#10b981;">✓ {{ qs.totalAnswered }} 已答</span>
                  <span style="font-size:12px; color:#9ca3af;">— {{ qs.skipped }} 跳过</span>
                </div>
                <div style="font-size:15px; font-weight:600; color:#1f2937;">{{ qs.questionTitle }}</div>
                <div v-if="qs.average" style="font-size:13px; color:#667eea; margin-top:4px;">
                  平均分：<strong>{{ qs.average }}</strong> / {{ getMaxRating(qIdx) }} 分
                </div>
              </div>

              <div v-if="qs.questionType === 'radio' || qs.questionType === 'checkbox'">
                <div class="flex" style="gap:16px; flex-wrap:wrap;">
                  <div :ref="el => setChartRef(qs.questionId, 'pie', el)" style="width:200px; height:200px;"></div>
                  <div :ref="el => setChartRef(qs.questionId, 'bar', el)" style="flex:1; min-width:200px; height:200px;"></div>
                </div>
                <div style="margin-top:12px; display:flex; flex-direction:column; gap:6px;">
                  <div v-for="item in qs.data" :key="item.value" style="display:flex; align-items:center; gap:10px;">
                    <span style="flex:0 0 100px; font-size:13px; color:#374151; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{{ item.label }}</span>
                    <div style="flex:1; height:22px; background:#f3f4f6; border-radius:4px; overflow:hidden; position:relative;">
                      <div style="height:100%; background:linear-gradient(90deg, #667eea 0%, #764ba2 100%); border-radius:4px; transition:width 0.5s;"
                           :style="{ width: getPercent(item.count, qs.totalAnswered) + '%' }"></div>
                      <span style="position:absolute; inset:0; display:flex; align-items:center; padding:0 8px; font-size:12px; font-weight:600; color:#1f2937;">
                        {{ item.count }} 次 ({{ getPercent(item.count, qs.totalAnswered).toFixed(1) }}%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div v-else-if="qs.questionType === 'rating'">
                <div :ref="el => setChartRef(qs.questionId, 'bar', el)" style="height:200px;"></div>
              </div>

              <div v-else-if="qs.questionType === 'text'">
                <div v-if="qs.data && qs.data.length" style="max-height:300px; overflow-y:auto; display:flex; flex-direction:column; gap:8px;">
                  <div v-for="(item, i) in qs.data" :key="i" style="padding:10px 12px; background:#f9fafb; border-left:3px solid #667eea; border-radius:6px; font-size:13px;">
                    <span style="color:#9ca3af; margin-right:6px;">#{{ i + 1 }}</span>
                    <span>{{ item.value }}</span>
                  </div>
                </div>
                <div v-else style="color:#9ca3af; font-size:13px; padding:16px; background:#fafafa; border-radius:8px;">暂无作答内容</div>
              </div>
            </div>
          </div>
          <div v-else class="empty-state" style="padding:40px;">暂无统计数据</div>
        </div>
      </div>
    </div>

    <div v-if="detailVisible" class="modal-overlay" @click.self="detailVisible = false">
      <div class="modal-box" style="max-width:720px;">
        <div class="flex justify-between items-center mb-4">
          <h3 style="font-size:18px; font-weight:600;">答卷详情</h3>
          <button class="btn btn-sm btn-secondary" @click="detailVisible = false">关闭 ✕</button>
        </div>
        <div v-if="detailLoading" style="text-align:center; padding:40px; color:#9ca3af;">加载中...</div>
        <div v-else-if="detailData">
          <div style="background:#f3f4f6; border-radius:8px; padding:12px 16px; margin-bottom:16px; font-size:13px; display:flex; justify-content:space-between; color:#4b5563;">
            <span>提交时间：{{ detailData.submittedAtStr }}</span>
            <span>答卷ID：{{ detailData.id.substring(0, 8) }}...</span>
          </div>
          <div style="max-height:60vh; overflow-y:auto; display:flex; flex-direction:column; gap:14px;">
            <div v-for="(q, idx) in detailQuestions" :key="q.id" style="border:1px solid #e5e7eb; border-radius:8px; padding:12px;">
              <div style="font-weight:600; color:#1f2937; margin-bottom:8px;">
                {{ idx + 1 }}. {{ q.title }}
                <span class="tag" :class="getTypeTagClass(q.type)" style="margin-left:6px; font-size:11px;">{{ getTypeLabel(q.type) }}</span>
              </div>
              <div style="padding:8px 12px; background:#f9fafb; border-radius:6px; color:#374151;">
                {{ getAnswerDisplay(q.id, q.type) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick, watch } from 'vue';
import { useRoute } from 'vue-router';
import * as echarts from 'echarts';
import api from '../utils/api';

const route = useRoute();
const surveyId = computed(() => route.params.id);

const loading = ref(true);
const surveyTitle = ref('');
const statsData = ref(null);
const startTime = ref('');
const endTime = ref('');

const trendChartRef = ref(null);
const chartRefs = reactive({});

const responseList = reactive({ list: [], total: 0 });
const responsePage = ref(1);
const responsePageSize = 15;
const totalResponsePages = computed(() => Math.max(1, Math.ceil(responseList.total / responsePageSize)));

const detailVisible = ref(false);
const detailLoading = ref(false);
const detailData = ref(null);
const detailQuestions = ref([]);

const avgAnswered = computed(() => {
  if (!statsData.value || !statsData.value.questionStats || statsData.value.totalResponses === 0) return '0';
  const sum = statsData.value.questionStats.reduce((s, q) => s + q.totalAnswered, 0);
  return (sum / statsData.value.totalResponses).toFixed(1);
});

const COLORS = ['#667eea', '#764ba2', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316'];

function getTypeLabel(t) {
  return { radio: '单选', checkbox: '多选', text: '填空', rating: '评分' }[t] || t;
}
function getTypeTagClass(t) {
  return { radio: 'tag-radio', checkbox: 'tag-checkbox', text: 'tag-text', rating: 'tag-rating' }[t];
}
function getPercent(count, total) {
  if (!total) return 0;
  return (count / total) * 100;
}
function formatDate(t) {
  if (!t) return '-';
  const d = new Date(t);
  return d.toISOString().replace('T', ' ').substring(0, 16);
}
function getMaxRating(qIdx) {
  if (statsData.value && statsData.value.questionStats && statsData.value.questionStats[qIdx]) {
    const d = statsData.value.questionStats[qIdx].data || [];
    if (d.length) return d.length;
  }
  return 5;
}
function setChartRef(qid, type, el) {
  const key = qid + '_' + type;
  if (el) chartRefs[key] = el;
}

async function loadStats() {
  loading.value = true;
  try {
    const params = {};
    if (startTime.value) params.startTime = startTime.value;
    if (endTime.value) params.endTime = endTime.value;
    const res = await api.get(`/stats/survey/${surveyId.value}`, { params });
    if (res.success) {
      statsData.value = res.data;
      surveyTitle.value = res.data.surveyTitle;
      await nextTick();
      renderCharts();
    } else {
      alert(res.message || '加载统计数据失败');
    }
  } catch (e) {
    alert('加载失败: ' + (e.message || '请检查后端服务'));
  } finally {
    loading.value = false;
  }
}

function renderTrendChart() {
  if (!trendChartRef.value || !statsData.value || !statsData.value.dailyTrend) return;
  const trend = statsData.value.dailyTrend;
  const instance = echarts.init(trendChartRef.value);
  instance.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 20, bottom: 40 },
    xAxis: {
      type: 'category',
      data: trend.map(t => t.date.substring(5)),
      axisLabel: { fontSize: 11 }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { fontSize: 11 }
    },
    series: [{
      type: 'line',
      smooth: true,
      data: trend.map(t => t.count),
      itemStyle: { color: '#667eea' },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(102,126,234,0.4)' },
          { offset: 1, color: 'rgba(102,126,234,0.02)' }
        ])
      },
      lineStyle: { width: 3 },
      symbol: 'circle',
      symbolSize: 8
    }]
  });
  window.addEventListener('resize', () => instance.resize());
}

function renderPieChart(el, data) {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const instance = echarts.init(el);
  instance.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { show: false },
    series: [{
      type: 'pie',
      radius: ['40%', '72%'],
      avoidLabelOverlap: true,
      itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 4 },
      label: { show: true, formatter: '{d}%', fontSize: 11 },
      labelLine: { length: 6, length2: 4 },
      data: data.map((d, i) => ({
        name: d.label,
        value: d.count,
        itemStyle: { color: COLORS[i % COLORS.length] }
      })).filter(d => d.value > 0)
    }]
  });
  window.addEventListener('resize', () => instance.resize());
}

function renderBarChart(el, data, catName = '选项') {
  const instance = echarts.init(el);
  instance.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 40, right: 20, top: 20, bottom: 40 },
    xAxis: {
      type: 'category',
      data: data.map(d => d.label || (d.rating + '分')),
      axisLabel: { fontSize: 11, interval: 0, rotate: data.length > 6 ? 30 : 0 }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { fontSize: 11 }
    },
    series: [{
      type: 'bar',
      data: data.map((d, i) => ({
        value: d.count,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: COLORS[i % COLORS.length] },
            { offset: 1, color: COLORS[(i + 1) % COLORS.length] + '99' }
          ]),
          borderRadius: [4, 4, 0, 0]
        }
      })),
      barWidth: '50%',
      label: { show: true, position: 'top', fontSize: 11 }
    }]
  });
  window.addEventListener('resize', () => instance.resize());
}

function renderCharts() {
  if (!statsData.value) return;
  renderTrendChart();
  if (statsData.value.questionStats) {
    statsData.value.questionStats.forEach(qs => {
      if (qs.questionType === 'radio' || qs.questionType === 'checkbox') {
        const pieEl = chartRefs[qs.questionId + '_pie'];
        const barEl = chartRefs[qs.questionId + '_bar'];
        if (pieEl) renderPieChart(pieEl, qs.data || []);
        if (barEl) renderBarChart(barEl, qs.data || []);
      } else if (qs.questionType === 'rating') {
        const barEl = chartRefs[qs.questionId + '_bar'];
        if (barEl) renderBarChart(barEl, (qs.data || []).map(d => ({ label: d.rating + '分', count: d.count })), '分值');
      }
    });
  }
}

function clearFilter() {
  startTime.value = '';
  endTime.value = '';
  loadStats();
  loadResponseList();
}

async function loadResponseList() {
  try {
    const params = { page: responsePage.value, pageSize: responsePageSize };
    if (startTime.value) params.startTime = startTime.value;
    if (endTime.value) params.endTime = endTime.value;
    const res = await api.get(`/responses/survey/${surveyId.value}`, { params });
    if (res.success) {
      responseList.list = res.data.list;
      responseList.total = res.data.total;
    }
  } catch (e) {
    console.error(e);
  }
}

function changeResponsePage(delta) {
  responsePage.value += delta;
  loadResponseList();
}

async function viewResponse(id) {
  detailVisible.value = true;
  detailLoading.value = true;
  try {
    const res = await api.get(`/responses/${id}`);
    if (res.success) {
      detailData.value = res.data;
      detailQuestions.value = res.data.questions || [];
    }
  } catch (e) {
    alert('加载失败: ' + (e.message || ''));
  } finally {
    detailLoading.value = false;
  }
}

function getAnswerDisplay(qid, type) {
  if (!detailData.value) return '';
  const a = detailData.value.answers.find(x => x.questionId === qid);
  if (!a) return '<未作答>';
  const q = detailQuestions.value.find(x => x.id === qid);
  if (type === 'text') return a.value || '<空>';
  if (type === 'rating') return (typeof a.value === 'number' ? a.value : 0) + ' 分';
  if (type === 'radio') {
    if (!q) return String(a.value ?? '<未作答>');
    const opt = (q.options || []).find(o => o.value === a.value);
    return opt ? opt.label : String(a.value ?? '<未作答>');
  }
  if (type === 'checkbox') {
    if (!Array.isArray(a.value) || a.value.length === 0) return '<未选择>';
    return a.value.map(v => {
      const opt = (q?.options || []).find(o => o.value === v);
      return opt ? opt.label : String(v);
    }).join('、');
  }
  return String(a.value);
}

function exportReport(format) {
  let url = `/api/export/survey/${surveyId.value}?format=${format}`;
  if (startTime.value) url += `&startTime=${startTime.value}`;
  if (endTime.value) url += `&endTime=${endTime.value}`;
  const link = document.createElement('a');
  link.href = url;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => document.body.removeChild(link), 1000);
}

onMounted(async () => {
  await loadStats();
  await loadResponseList();
});

watch([startTime, endTime], () => {
  loadResponseList();
});
</script>

<style scoped>
.stat-card {
  padding:20px;
  border-radius:12px;
  display:flex;
  flex-direction:column;
  gap:6px;
}
.stat-label {
  font-size:13px;
  opacity:0.9;
}
.stat-value {
  font-size:30px;
  font-weight:800;
  letter-spacing:0.5px;
}
.stat-value.small {
  font-size:14px;
  letter-spacing:0;
}

.question-stat-card {
  padding:16px;
  border:1px solid #e5e7eb;
  border-radius:12px;
  background:#fafafa;
}

.tag-radio { background:#dbeafe; color:#1e40af; }
.tag-checkbox { background:#dcfce7; color:#166534; }
.tag-text { background:#fef9c3; color:#854d0e; }
.tag-rating { background:#fce7f3; color:#9d174d; }
</style>
