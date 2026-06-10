<template>
  <div style="max-width:760px; margin:0 auto;">
    <div v-if="loading" class="empty-state page-container">
      <div class="empty-state-icon">⏳</div>
      <p>加载中...</p>
    </div>

    <div v-else-if="loadError" class="page-container" style="text-align:center;">
      <div style="font-size:64px; margin-bottom:16px;">⚠️</div>
      <h2 style="color:#dc2626; margin-bottom:8px;">{{ loadError }}</h2>
      <p style="color:#6b7280;">请检查问卷链接是否正确，或联系问卷发布者</p>
    </div>

    <div v-else-if="submitted" class="page-container" style="text-align:center;">
      <div style="font-size:72px; margin-bottom:20px;">🎉</div>
      <h2 style="font-size:24px; font-weight:700; color:#059669; margin-bottom:8px;">提交成功！</h2>
      <p style="color:#6b7280; margin-bottom:6px;">感谢您的作答</p>
      <p style="color:#9ca3af; font-size:13px; margin-bottom:24px;">提交时间：{{ submitTime }}</p>
      <button class="btn btn-primary" @click="resetAndRetry">再答一份</button>
    </div>

    <div v-else class="page-container">
      <div style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:white; padding:28px 32px; border-radius:12px; margin:-32px -32px 32px -32px;">
        <h1 style="font-size:24px; font-weight:700; margin-bottom:8px;">{{ survey.title }}</h1>
        <p v-if="survey.description" style="opacity:0.9; line-height:1.6;">{{ survey.description }}</p>
        <div style="margin-top:16px; display:flex; gap:16px; font-size:13px; opacity:0.85;">
          <span>📝 共 {{ survey.questions.length }} 题</span>
          <span>⏱️ 预计用时 {{ estimateTime }} 分钟</span>
        </div>
      </div>

      <div v-if="errors.length" style="background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:12px 16px; margin-bottom:20px;">
        <div style="color:#dc2626; font-weight:600; margin-bottom:6px;">请修正以下问题：</div>
        <ul style="color:#b91c1c; padding-left:20px; font-size:13px;">
          <li v-for="(e, i) in errors" :key="i">{{ e }}</li>
        </ul>
      </div>

      <form @submit.prevent="onSubmit" style="display:flex; flex-direction:column; gap:24px;">
        <div v-for="(q, idx) in survey.questions" :key="q.id" class="question-card"
             :style="{ border: fieldErrors[q.id] ? '2px solid #fecaca' : '1px solid #e5e7eb' }">
          <div style="margin-bottom:14px;">
            <span style="display:inline-flex; align-items:center; gap:6px;">
              <span style="background:#f3f4f6; color:#374151; padding:4px 10px; border-radius:6px; font-size:13px; font-weight:600;">
                {{ idx + 1 }}
              </span>
              <span class="tag" :class="getTypeTagClass(q.type)">{{ getTypeLabel(q.type) }}</span>
              <span v-if="q.required" style="color:#ef4444; font-weight:700;">*</span>
            </span>
            <div style="font-size:16px; font-weight:600; color:#1f2937; margin-top:8px;">{{ q.title }}</div>
            <div v-if="getHint(q)" style="font-size:12px; color:#9ca3af; margin-top:4px;">{{ getHint(q) }}</div>
          </div>

          <div v-if="q.type === 'radio'" style="display:flex; flex-direction:column; gap:10px;">
            <label v-for="opt in q.options" :key="opt.value" class="option-label">
              <input type="radio" :name="'q_' + q.id" :value="opt.value" v-model="answers[q.id]" />
              <span class="option-radio"></span>
              <span>{{ opt.label }}</span>
            </label>
          </div>

          <div v-else-if="q.type === 'checkbox'">
            <div style="display:flex; flex-direction:column; gap:10px;">
              <label v-for="opt in q.options" :key="opt.value" class="option-label">
                <input type="checkbox" :value="opt.value" v-model="checkboxAnswers[q.id]" />
                <span class="option-check"></span>
                <span>{{ opt.label }}</span>
              </label>
            </div>
            <div v-if="isCheckboxLimit(q)" style="font-size:12px; color:#6b7280; margin-top:10px;">
              已选 {{ checkboxAnswers[q.id].length }} / {{ q.maxSelect ? q.maxSelect : q.options.length }} 项
            </div>
          </div>

          <div v-else-if="q.type === 'text'">
            <textarea v-model="answers[q.id]" :placeholder="'请输入回答...'"
                      :rows="q.maxLength && q.maxLength > 200 ? 6 : 3"
                      :maxlength="q.maxLength && q.maxLength > 0 ? q.maxLength : undefined"></textarea>
            <div v-if="q.maxLength" style="font-size:12px; color:#9ca3af; text-align:right; margin-top:4px;">
              {{ (answers[q.id] || '').length }} / {{ q.maxLength }}
            </div>
          </div>

          <div v-else-if="q.type === 'rating'" class="rating-wrapper">
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button v-for="n in q.maxValue" :key="n" type="button"
                      class="rating-btn"
                      :class="{ active: Number(answers[q.id]) >= n, hovered: hoverRating[q.id] >= n && hoverRating[q.id] > 0 }"
                      @click="answers[q.id] = n"
                      @mouseenter="hoverRating[q.id] = n"
                      @mouseleave="hoverRating[q.id] = 0">
                <span class="rating-icon">{{ Number(answers[q.id]) >= n || hoverRating[q.id] >= n ? '⭐' : '☆' }}</span>
                <span class="rating-num">{{ n }}</span>
              </button>
            </div>
            <div v-if="answers[q.id]" style="margin-top:8px; font-size:13px; color:#667eea; font-weight:500;">
              您打了 {{ answers[q.id] }} 分
            </div>
          </div>

          <div v-if="fieldErrors[q.id]" style="color:#ef4444; font-size:13px; margin-top:10px;">
            ⚠️ {{ fieldErrors[q.id] }}
          </div>
        </div>

        <div style="position:sticky; bottom:-32px; margin:0 -32px -32px -32px; padding:16px 32px; background:white; border-top:1px solid #e5e7eb; display:flex; justify-content:space-between; align-items:center;">
          <div style="font-size:13px; color:#6b7280;">
            已完成 {{ answeredCount }} / {{ totalRequired }} 必填题
          </div>
          <button type="submit" class="btn btn-primary" :disabled="submitting" style="padding:12px 36px; font-size:15px;">
            {{ submitting ? '提交中...' : '提交答卷' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import api from '../utils/api';

const route = useRoute();
const loading = ref(true);
const loadError = ref('');
const survey = ref({ id: '', title: '', description: '', questions: [] });
const answers = reactive({});
const checkboxAnswers = reactive({});
const hoverRating = reactive({});
const errors = ref([]);
const fieldErrors = reactive({});
const submitting = ref(false);
const submitted = ref(false);
const submitTime = ref('');

const estimateTime = computed(() => {
  const qs = survey.value.questions;
  let t = qs.reduce((s, q) => {
    if (q.type === 'text') return s + 1.5;
    if (q.type === 'rating') return s + 0.3;
    return s + 0.5;
  }, 0);
  return Math.max(1, Math.round(t));
});

const totalRequired = computed(() => survey.value.questions.filter(q => q.required).length);

const answeredCount = computed(() => {
  return survey.value.questions.filter(q => {
    if (!q.required) return true;
    if (q.type === 'checkbox') return checkboxAnswers[q.id] && checkboxAnswers[q.id].length > 0;
    if (q.type === 'text') return answers[q.id] && answers[q.id].toString().trim();
    if (q.type === 'rating') return typeof answers[q.id] === 'number' && answers[q.id] > 0;
    return answers[q.id] !== undefined && answers[q.id] !== null && answers[q.id] !== '';
  }).length;
});

function getTypeLabel(type) {
  return { radio: '单选', checkbox: '多选', text: '填空', rating: '评分' }[type];
}
function getTypeTagClass(type) {
  return { radio: 'tag-radio', checkbox: 'tag-checkbox', text: 'tag-text', rating: 'tag-rating' }[type];
}
function getHint(q) {
  if (q.type === 'text') {
    const parts = [];
    if (q.minLength) parts.push(`最少${q.minLength}字`);
    if (q.maxLength) parts.push(`最多${q.maxLength}字`);
    return parts.length ? parts.join('，') : '';
  }
  if (q.type === 'checkbox') {
    const parts = [];
    if (q.minSelect) parts.push(`至少选${q.minSelect}项`);
    if (q.maxSelect) parts.push(`最多选${q.maxSelect}项`);
    return parts.length ? parts.join('，') : '';
  }
  if (q.type === 'rating') return `满分${q.maxValue}分，点击星星进行评分`;
  return '';
}
function isCheckboxLimit(q) {
  return q.type === 'checkbox' && (q.maxSelect || 0) > 0;
}

function validateForm() {
  errors.value = [];
  Object.keys(fieldErrors).forEach(k => delete fieldErrors[k]);

  survey.value.questions.forEach((q, idx) => {
    const prefix = `第${idx + 1}题`;
    if (q.required) {
      if (q.type === 'checkbox' && (!checkboxAnswers[q.id] || checkboxAnswers[q.id].length === 0)) {
        fieldErrors[q.id] = '此题为必答题';
      } else if (q.type === 'text' && (!answers[q.id] || !answers[q.id].toString().trim())) {
        fieldErrors[q.id] = '此题为必答题';
      } else if (q.type === 'rating' && (typeof answers[q.id] !== 'number' || answers[q.id] < 1)) {
        fieldErrors[q.id] = '请进行评分';
      } else if (q.type === 'radio' && (answers[q.id] === undefined || answers[q.id] === '' || answers[q.id] === null)) {
        fieldErrors[q.id] = '请选择一个选项';
      }
    }
    if (fieldErrors[q.id]) return;

    if (q.type === 'text' && answers[q.id]) {
      const val = answers[q.id].toString();
      if (q.minLength && val.length < q.minLength) fieldErrors[q.id] = `至少需要${q.minLength}个字`;
      if (q.maxLength && val.length > q.maxLength) fieldErrors[q.id] = `最多允许${q.maxLength}个字`;
    }
    if (q.type === 'checkbox' && checkboxAnswers[q.id] && checkboxAnswers[q.id].length > 0) {
      if (q.minSelect && checkboxAnswers[q.id].length < q.minSelect) fieldErrors[q.id] = `至少选择${q.minSelect}项`;
      if (q.maxSelect && checkboxAnswers[q.id].length > q.maxSelect) {
        fieldErrors[q.id] = `最多选择${q.maxSelect}项`;
        checkboxAnswers[q.id] = checkboxAnswers[q.id].slice(0, q.maxSelect);
      }
    }
  });

  return Object.keys(fieldErrors).length === 0;
}

async function onSubmit() {
  if (!validateForm()) {
    const firstQ = survey.value.questions.find(q => fieldErrors[q.id]);
    if (firstQ) {
      errors.value = ['请检查并修正标红的题目'];
      const el = document.querySelector(`[data-qid="${firstQ.id}"]`) || document.querySelector('.question-card');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return;
  }

  submitting.value = true;
  const payload = {
    surveyId: survey.value.id,
    accessToken: route.params.token,
    answers: survey.value.questions.map(q => {
      let value;
      if (q.type === 'checkbox') value = checkboxAnswers[q.id] || [];
      else if (q.type === 'rating') value = answers[q.id] ? Number(answers[q.id]) : 0;
      else value = answers[q.id] || '';
      return { questionId: q.id, value };
    })
  };

  try {
    const res = await api.post('/responses', payload);
    if (res.success) {
      submitTime.value = res.data.submittedAt;
      submitted.value = true;
    } else {
      if (res.errors) {
        errors.value = res.errors;
      } else {
        errors.value = [res.message || '提交失败，请稍后重试'];
      }
    }
  } catch (e) {
    errors.value = ['提交失败：' + (e.message || '网络错误，请检查后端服务')];
  } finally {
    submitting.value = false;
  }
}

function resetAndRetry() {
  submitted.value = false;
  Object.keys(answers).forEach(k => delete answers[k]);
  Object.keys(checkboxAnswers).forEach(k => checkboxAnswers[k] = []);
  Object.keys(fieldErrors).forEach(k => delete fieldErrors[k]);
  errors.value = [];
  initAnswers();
}

function initAnswers() {
  survey.value.questions.forEach(q => {
    if (q.type === 'checkbox') {
      if (!checkboxAnswers[q.id]) checkboxAnswers[q.id] = [];
    }
  });
}

async function loadSurvey() {
  loading.value = true;
  loadError.value = '';
  try {
    const res = await api.get(`/surveys/access/${route.params.token}`);
    if (res.success) {
      survey.value = res.data;
      initAnswers();
    } else {
      loadError.value = res.message || '加载失败';
    }
  } catch (e) {
    loadError.value = '加载失败：' + (e.message || '请检查后端服务');
  } finally {
    loading.value = false;
  }
}

onMounted(loadSurvey);
</script>

<style scoped>
.question-card {
  background:#fafafa;
  border-radius:12px;
  padding:20px;
  transition:border-color 0.2s;
}
.tag-radio { background:#dbeafe; color:#1e40af; }
.tag-checkbox { background:#dcfce7; color:#166534; }
.tag-text { background:#fef9c3; color:#854d0e; }
.tag-rating { background:#fce7f3; color:#9d174d; }

.option-label {
  display:flex;
  align-items:center;
  gap:10px;
  padding:12px 16px;
  background:white;
  border:1px solid #e5e7eb;
  border-radius:8px;
  cursor:pointer;
  transition:all 0.2s;
  font-size:15px;
}
.option-label:hover {
  border-color:#c7d2fe;
  background:#eef2ff;
}
.option-label input[type="radio"],
.option-label input[type="checkbox"] {
  display:none;
}
.option-radio {
  width:20px;
  height:20px;
  border:2px solid #d1d5db;
  border-radius:50%;
  flex-shrink:0;
  position:relative;
  transition:all 0.2s;
}
.option-check {
  width:20px;
  height:20px;
  border:2px solid #d1d5db;
  border-radius:5px;
  flex-shrink:0;
  position:relative;
  transition:all 0.2s;
}
.option-label input:checked ~ .option-radio,
.option-label input:checked ~ .option-check {
  border-color:#667eea;
  background:#667eea;
}
.option-label input:checked ~ .option-radio::after {
  content:'';
  position:absolute;
  top:50%;
  left:50%;
  transform:translate(-50%, -50%);
  width:8px;
  height:8px;
  background:white;
  border-radius:50%;
}
.option-label input:checked ~ .option-check::after {
  content:'✓';
  position:absolute;
  top:50%;
  left:50%;
  transform:translate(-50%, -60%);
  color:white;
  font-size:12px;
  font-weight:700;
}

.rating-btn {
  display:flex;
  align-items:center;
  gap:4px;
  padding:10px 14px;
  background:white;
  border:2px solid #e5e7eb;
  border-radius:10px;
  cursor:pointer;
  transition:all 0.2s;
  font-size:14px;
}
.rating-btn:hover {
  transform:scale(1.05);
  border-color:#c7d2fe;
}
.rating-btn.active {
  background:linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-color:#f59e0b;
}
.rating-btn.hovered:not(.active) {
  background:#fffbeb;
  border-color:#fde68a;
}
.rating-icon {
  font-size:20px;
}
.rating-num {
  font-weight:600;
  color:#6b7280;
}
.rating-btn.active .rating-num {
  color:#b45309;
}
</style>
