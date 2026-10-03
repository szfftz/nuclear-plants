import { createRouter, createWebHashHistory } from 'vue-router';
import HomeView from './views/HomeView.vue';
import ResultView from './views/ResultView.vue';

// 用 hash 路由，靜態主機（GitHub Pages）不用處理 404 轉址
export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'Home', component: HomeView },
    { path: '/result', name: 'Result', component: ResultView },
  ],
});
