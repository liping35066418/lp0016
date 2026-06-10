<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 style="font-size:24px; font-weight:700; margin-bottom:4px;">问卷列表</h1>
        <p style="color:#6b7280;">管理您的所有问卷，查看统计数据</p>
      </div>
      <button class="btn btn-primary" @click="$router.push('/create')">
        ➕ 创建问卷
      </button>
    </div>

    <div v-if="loading" style="text-align:center; padding:60px; color:#9ca3af;">加载中...</div>
    
    <div v-else-if="surveys.length === 0" class="empty-state page-container">
      <div class="empty-state-icon">📋</div>
      <h3 style="font-size:18px; color:#374151; margin-bottom:8px;">还没有问卷</h3>
      <p style="margin-bottom:20px;">点击上方按钮创建您的第一份问卷</p>
      <button class="btn btn-primary" @click="$router.push('/create')">创建问卷</button>
    </div>

    <div v-else class="page-container">
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:2px solid #e5e7eb;">
            <th style="text-align:left; padding:14px 12px; font-size:13px; color:#6b7280;">问卷标题</th>
            <th style="text-align:left; padding:14px 12px; font-size:13px; color:#6b7280;">题目数</th>
            <th style="text-align:left; padding:14px 12px; font-size:13px; color:#6b7280;">答卷数</th>
            <th style="text-align:left; padding:14px 12px; font-size:13px; color:#6b7280;">状态</th>
            <th style="text-align:left; padding:14px 12px; font-size:13px; color:#6b7280;">创建时间</th>
            <th style="text-align:right; padding:14px 12px; font-size:13px; color:#6b7280;">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in surveys" :key="s.id" style="border-bottom:1px solid #f3f4f6;" class="table-row">
            <td style="padding:14px 12px;">
              <div style="font-weight:600; color:#1f2937;">{{ s.title }}</div>
              <div v-if="s.description" style="font-size:12px; color:#9ca3af; margin-top:2px; max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                {{ s.description }}
              </div>
            </td>
            <td style="padding:14px 12px;">{{ s.questionCount || 0 }}</td>
            <td style="padding:14px 12px;">
              <span :style="{color: s.responseCount > 0 ? '#667eea' : '#9ca3af', fontWeight: s.responseCount > 0 ? 600 : 400}">
                {{ s.responseCount || 0 }}
              </span>
            </td>
            <td style="padding:14px 12px;">
              <span :class="['tag', s.status === 'published' ? 'tag-published' : 'tag-draft']">
                {{ s.status === 'published' ? '已发布' : '草稿' }}
              </span>
            </td>
            <td style="padding:14px 12px; font-size:13px; color:#6b7280;">
              {{ formatTime(s.createdAt) }}
            </td>
            <td style="padding:14px 12px;">
              <div class="flex" style="gap:6px; justify-content:flex-end; flex-wrap:wrap;">
                <button v-if="s.status === 'draft'" class="btn btn-sm btn-secondary" @click="$router.push('/edit/' + s.id)">编辑</button>
                <button v-if="s.status === 'draft'" class="btn btn-sm btn-success" @click="publishSurvey(s)">发布</button>
                <button v-if="s.status === 'published'" class="btn btn-sm btn-warning" @click="copyLink(s)">复制链接</button>
                <button v-if="s.status === 'published'" class="btn btn-sm btn-warning" @click="unpublishSurvey(s)">下架</button>
                <button class="btn btn-sm btn-primary" @click="$router.push('/stats/' + s.id)">统计</button>
                <button class="btn btn-sm btn-danger" @click="deleteSurvey(s)">删除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import api from '../utils/api';

const router = useRouter();
const surveys = ref([]);
const loading = ref(true);

async function loadSurveys() {
  loading.value = true;
  try {
    const res = await api.get('/surveys');
    if (res.success) surveys.value = res.data || [];
  } catch (e) {
    alert('加载失败: ' + (e.message || '请检查后端服务'));
  } finally {
    loading.value = false;
  }
}

async function publishSurvey(s) {
  if (!confirm(`确认发布问卷"${s.title}"？发布后将无法编辑，除非先下架。`)) return;
  try {
    const res = await api.post(`/surveys/${s.id}/publish`);
    if (res.success) {
      alert('发布成功！访问链接：\n' + res.data.accessLink);
      await loadSurveys();
    } else {
      alert(res.message || '发布失败');
    }
  } catch (e) {
    alert('发布失败: ' + (e.message || ''));
  }
}

async function unpublishSurvey(s) {
  if (!confirm('确认下架该问卷？下架后用户将无法访问。')) return;
  try {
    const res = await api.post(`/surveys/${s.id}/unpublish`);
    if (res.success) {
      alert('已下架');
      await loadSurveys();
    } else alert(res.message || '操作失败');
  } catch (e) {
    alert('操作失败: ' + (e.message || ''));
  }
}

async function deleteSurvey(s) {
  if (!confirm(`确认删除问卷"${s.title}"？此操作不可恢复，答卷数据也将失去关联。`)) return;
  try {
    const res = await api.delete(`/surveys/${s.id}`);
    if (res.success) {
      alert('删除成功');
      await loadSurveys();
    } else alert(res.message || '删除失败');
  } catch (e) {
    alert('删除失败: ' + (e.message || ''));
  }
}

function copyLink(s) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(s.accessLink).then(() => {
      alert('链接已复制到剪贴板');
    }).catch(() => {
      prompt('复制以下链接:', s.accessLink);
    });
  } else {
    prompt('复制以下链接:', s.accessLink);
  }
}

function formatTime(t) {
  if (!t) return '-';
  const d = new Date(t);
  return d.toISOString().replace('T', ' ').substring(0, 16);
}

onMounted(loadSurveys);
</script>

<style scoped>
.table-row:hover {
  background: #f9fafb;
}
</style>
