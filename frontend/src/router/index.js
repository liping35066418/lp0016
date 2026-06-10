import { createRouter, createWebHistory } from 'vue-router';
import SurveyList from '../views/SurveyList.vue';
import SurveyCreate from '../views/SurveyCreate.vue';
import SurveyEdit from '../views/SurveyEdit.vue';
import SurveyAnswer from '../views/SurveyAnswer.vue';
import SurveyStats from '../views/SurveyStats.vue';

const routes = [
  { path: '/', name: 'SurveyList', component: SurveyList },
  { path: '/create', name: 'SurveyCreate', component: SurveyCreate },
  { path: '/edit/:id', name: 'SurveyEdit', component: SurveyEdit },
  { path: '/survey/:token', name: 'SurveyAnswer', component: SurveyAnswer },
  { path: '/stats/:id', name: 'SurveyStats', component: SurveyStats }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
