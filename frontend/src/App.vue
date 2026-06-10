<template>
  <div class="app-container">
    <header class="app-header">
      <div class="header-inner">
        <div class="logo" @click="$router.push('/')">
          <span class="logo-icon">📋</span>
          <span class="logo-text">问卷平台</span>
        </div>
        <nav class="nav-menu" v-if="!isSurveyAnswerPage">
          <router-link to="/" exact-active-class="active">问卷列表</router-link>
          <router-link to="/create" active-class="active">创建问卷</router-link>
        </nav>
      </div>
    </header>
    <main class="app-main">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
const route = useRoute();
const isSurveyAnswerPage = computed(() => route.path.startsWith('/survey/') && route.name !== 'SurveyList');
</script>
