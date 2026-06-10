<template>
  <div>
    <div class="page-container">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 style="font-size:24px; font-weight:700;">{{ isEdit ? '编辑问卷' : '创建问卷' }}</h1>
          <p style="color:#6b7280;">添加题目并设置题目属性</p>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-secondary" @click="$router.push('/')">返回</button>
          <button class="btn btn-primary" :disabled="saving" @click="saveSurvey(false)">
            {{ saving ? '保存中...' : '保存草稿' }}
          </button>
          <button class="btn btn-success" :disabled="saving" @click="saveSurvey(true)">
            保存并发布
          </button>
        </div>
      </div>

      <div v-if="errors.length" style="background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:12px 16px; margin-bottom:20px;">
        <div style="color:#dc2626; font-weight:600; margin-bottom:6px;">数据校验失败：</div>
        <ul style="color:#b91c1c; padding-left:20px; font-size:13px;">
          <li v-for="(e, i) in errors" :key="i">{{ e }}</li>
        </ul>
      </div>

      <div class="form-group">
        <label class="form-label">问卷标题 <span style="color:#ef4444;">*</span></label>
        <input v-model="form.title" placeholder="请输入问卷标题" style="font-size:16px; padding:14px;"/>
      </div>

      <div class="form-group">
        <label class="form-label">问卷描述</label>
        <textarea v-model="form.description" placeholder="请输入问卷说明（可选）" style="min-height:70px;"></textarea>
      </div>

      <div class="divider"></div>

      <div class="flex justify-between items-center mb-4">
        <h2 style="font-size:18px; font-weight:600;">题目列表（{{ questions.length }}）</h2>
        <div class="flex gap-2">
          <button class="btn btn-sm btn-secondary" @click="addQuestion('radio')">➕ 单选题</button>
          <button class="btn btn-sm btn-secondary" @click="addQuestion('checkbox')">➕ 多选题</button>
          <button class="btn btn-sm btn-secondary" @click="addQuestion('text')">➕ 填空题</button>
          <button class="btn btn-sm btn-secondary" @click="addQuestion('rating')">➕ 评分题</button>
        </div>
      </div>

      <div v-if="questions.length === 0" class="empty-state" style="border:2px dashed #d1d5db; border-radius:12px; background:#fafafa;">
        <div class="empty-state-icon">❓</div>
        <p>点击上方按钮添加题目</p>
      </div>

      <div v-else style="display:flex; flex-direction:column; gap:16px;">
        <div v-for="(q, idx) in questions" :key="q.id" style="border:1px solid #e5e7eb; border-radius:12px; background:#fafafa; overflow:hidden;">
          <div style="background:linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%); padding:12px 16px; display:flex; align-items:center; justify-content:space-between;">
            <div style="display:flex; align-items:center; gap:12px;">
              <span style="background:#667eea; color:white; width:28px; height:28px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-weight:700; font-size:14px;">
                {{ idx + 1 }}
              </span>
              <span :class="['tag', getTypeTagClass(q.type)]">{{ getTypeLabel(q.type) }}</span>
              <label style="display:inline-flex; align-items:center; gap:6px; font-size:13px; cursor:pointer;">
                <input type="checkbox" v-model="q.required" style="width:auto;"/>
                <span :style="{color: q.required ? '#dc2626' : '#6b7280'}">{{ q.required ? '必填' : '选填' }}</span>
              </label>
            </div>
            <div class="flex gap-2">
              <button class="btn btn-sm btn-secondary" :disabled="idx === 0" @click="moveQuestion(idx, -1)" title="上移">⬆️</button>
              <button class="btn btn-sm btn-secondary" :disabled="idx === questions.length - 1" @click="moveQuestion(idx, 1)" title="下移">⬇️</button>
              <button class="btn btn-sm btn-danger" @click="removeQuestion(idx)" title="删除">🗑️</button>
            </div>
          </div>

          <div style="padding:16px;">
            <div class="form-group">
              <label class="form-label">题目标题 <span style="color:#ef4444;">*</span></label>
              <input v-model="q.title" placeholder="请输入题目标题"/>
            </div>

            <div v-if="q.type === 'radio' || q.type === 'checkbox'">
              <label class="form-label">选项设置</label>
              <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:12px;">
                <div v-for="(opt, oIdx) in q.options" :key="oIdx" class="flex items-center gap-2">
                  <span style="color:#6b7280; min-width:24px;">{{ getOptionLabel(oIdx) }}.</span>
                  <input v-model="opt.label" :placeholder="'选项' + getOptionLabel(oIdx)"/>
                  <input type="hidden" v-model="opt.value"/>
                  <button class="btn btn-sm btn-secondary" @click="moveOption(q, oIdx, -1)" :disabled="oIdx === 0">⬆️</button>
                  <button class="btn btn-sm btn-secondary" @click="moveOption(q, oIdx, 1)" :disabled="oIdx === q.options.length - 1">⬇️</button>
                  <button class="btn btn-sm btn-danger" @click="removeOption(q, oIdx)" :disabled="q.options.length <= (q.type === 'radio' ? 2 : 1)">删除</button>
                </div>
              </div>
              <button class="btn btn-sm btn-secondary" @click="addOption(q)">➕ 添加选项</button>

              <div v-if="q.type === 'checkbox'" style="margin-top:16px; padding:12px; background:#f3f4f6; border-radius:8px;">
                <div style="font-weight:500; margin-bottom:8px;">作答限制</div>
                <div class="flex gap-3 items-center">
                  <div style="flex:1;">
                    <label style="font-size:13px; color:#6b7280; display:block; margin-bottom:4px;">最少选择（0为不限制）</label>
                    <input type="number" v-model.number="q.minSelect" min="0"/>
                  </div>
                  <div style="flex:1;">
                    <label style="font-size:13px; color:#6b7280; display:block; margin-bottom:4px;">最多选择（0为不限制）</label>
                    <input type="number" v-model.number="q.maxSelect" min="0"/>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="q.type === 'text'" style="padding:12px; background:#f3f4f6; border-radius:8px;">
              <div style="font-weight:500; margin-bottom:8px;">字数限制</div>
              <div class="flex gap-3 items-center">
                <div style="flex:1;">
                  <label style="font-size:13px; color:#6b7280; display:block; margin-bottom:4px;">最少字数（0为不限制）</label>
                  <input type="number" v-model.number="q.minLength" min="0"/>
                </div>
                <div style="flex:1;">
                  <label style="font-size:13px; color:#6b7280; display:block; margin-bottom:4px;">最多字数（0为不限制）</label>
                  <input type="number" v-model.number="q.maxLength" min="0"/>
                </div>
              </div>
            </div>

            <div v-if="q.type === 'rating'" style="padding:12px; background:#f3f4f6; border-radius:8px;">
              <div class="flex gap-3 items-center">
                <div style="flex:1;">
                  <label style="font-size:13px; color:#6b7280; display:block; margin-bottom:4px;">最高分值</label>
                  <select v-model.number="q.maxValue">
                    <option v-for="n in 10" :key="n" :value="n">{{ n }} 分</option>
                  </select>
                </div>
                <div style="flex:2;">
                  <label style="font-size:13px; color:#6b7280; display:block; margin-bottom:4px;">预览</label>
                  <div class="flex gap-1">
                    <span v-for="n in q.maxValue" :key="n" style="font-size:24px; cursor:pointer;">
                      {{ n <= 3 ? '⭐' : (n <= 5 ? '⭐' : '🔵') }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '../utils/api';

const route = useRoute();
const router = useRouter();

const isEdit = ref(false);
const editId = ref(null);
const saving = ref(false);
const errors = ref([]);

const form = reactive({
  title: '',
  description: ''
});

const questions = ref([]);

function uid() {
  return 'q_' + Math.random().toString(36).substring(2, 10);
}
function oid() {
  return 'o_' + Math.random().toString(36).substring(2, 8);
}

function addQuestion(type) {
  const q = {
    id: uid(),
    type,
    title: '',
    required: true,
    order: questions.value.length
  };
  if (type === 'radio' || type === 'checkbox') {
    q.options = [
      { label: '选项A', value: oid() },
      { label: '选项B', value: oid() }
    ];
    if (type === 'checkbox') {
      q.minSelect = 0;
      q.maxSelect = 0;
    }
  } else if (type === 'text') {
    q.minLength = 0;
    q.maxLength = 0;
  } else if (type === 'rating') {
    q.maxValue = 5;
  }
  questions.value.push(q);
  errors.value = [];
}

function removeQuestion(idx) {
  if (!confirm('确认删除该题目？')) return;
  questions.value.splice(idx, 1);
}

function moveQuestion(idx, dir) {
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= questions.value.length) return;
  const temp = questions.value[idx];
  questions.value[idx] = questions.value[newIdx];
  questions.value[newIdx] = temp;
}

function addOption(q) {
  const idx = q.options.length;
  q.options.push({ label: '选项' + getOptionLabel(idx), value: oid() });
}

function removeOption(q, idx) {
  q.options.splice(idx, 1);
  q.options.forEach((o, i) => {
    if (!o.label) o.label = '选项' + getOptionLabel(i);
  });
}

function moveOption(q, idx, dir) {
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= q.options.length) return;
  const temp = q.options[idx];
  q.options[idx] = q.options[newIdx];
  q.options[newIdx] = temp;
}

function getTypeLabel(type) {
  return { radio: '单选题', checkbox: '多选题', text: '填空题', rating: '评分题' }[type] || type;
}
function getTypeTagClass(type) {
  return { radio: 'tag-radio', checkbox: 'tag-checkbox', text: 'tag-text', rating: 'tag-rating' }[type];
}
function getOptionLabel(idx) {
  return String.fromCharCode(65 + idx);
}

function validate() {
  const errs = [];
  if (!form.title.trim()) errs.push('问卷标题不能为空');
  if (questions.value.length === 0) errs.push('请至少添加一道题目');
  questions.value.forEach((q, idx) => {
    const prefix = `第${idx + 1}题`;
    if (!q.title.trim()) errs.push(prefix + '标题不能为空');
    if ((q.type === 'radio' || q.type === 'checkbox')) {
      if (!q.options || q.options.length === 0) errs.push(prefix + '至少需要一个选项');
      else {
        const emptyOpt = q.options.some(o => !o.label || !o.label.trim());
        if (emptyOpt) errs.push(prefix + '存在空选项');
      }
      if (q.type === 'checkbox') {
        const min = q.minSelect || 0;
        const max = q.maxSelect || 0;
        if (min > 0 && max > 0 && min > max) errs.push(prefix + '最少选择数不能大于最多选择数');
        if (max > 0 && q.options && max > q.options.length) errs.push(prefix + '最多选择数不能大于选项总数');
      }
    }
    if (q.type === 'text') {
      const min = q.minLength || 0;
      const max = q.maxLength || 0;
      if (min > 0 && max > 0 && min > max) errs.push(prefix + '最少字数不能大于最多字数');
    }
  });
  return errs;
}

async function saveSurvey(publish) {
  errors.value = [];
  const errs = validate();
  if (errs.length > 0) {
    errors.value = errs;
    return;
  }

  const payload = {
    title: form.title.trim(),
    description: form.description || '',
    questions: questions.value.map((q, i) => ({ ...q, order: i }))
  };

  saving.value = true;
  try {
    let res;
    if (isEdit.value) {
      res = await api.put(`/surveys/${editId.value}`, payload);
    } else {
      res = await api.post('/surveys', payload);
    }

    if (!res.success) {
      errors.value = res.errors || [res.message || '保存失败'];
      saving.value = false;
      return;
    }

    if (publish) {
      const pub = await api.post(`/surveys/${res.data.id}/publish`);
      if (pub.success) {
        alert('发布成功！\n访问链接：' + pub.data.accessLink);
        router.push('/');
      } else {
        alert('保存成功，但发布失败：' + (pub.message || ''));
        router.push('/');
      }
    } else {
      alert(isEdit.value ? '修改已保存' : '已保存为草稿');
      router.push('/');
    }
  } catch (e) {
    alert('请求失败: ' + (e.message || '请检查后端服务'));
  } finally {
    saving.value = false;
  }
}

async function loadSurvey() {
  if (!route.params.id) return;
  isEdit.value = true;
  editId.value = route.params.id;
  try {
    const res = await api.get(`/surveys/${route.params.id}`);
    if (res.success) {
      form.title = res.data.title || '';
      form.description = res.data.description || '';
      questions.value = (res.data.questions || []).map(q => ({ ...q }));
    } else {
      alert(res.message || '加载失败');
      router.push('/');
    }
  } catch (e) {
    alert('加载失败: ' + (e.message || ''));
    router.push('/');
  }
}

onMounted(() => {
  if (route.params.id) {
    loadSurvey();
  } else {
    addQuestion('radio');
  }
});
</script>

<style scoped>
.tag-radio { background: #dbeafe; color: #1e40af; }
.tag-checkbox { background: #dcfce7; color: #166534; }
.tag-text { background: #fef9c3; color: #854d0e; }
.tag-rating { background: #fce7f3; color: #9d174d; }
</style>
