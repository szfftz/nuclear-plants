import { createRouter, createWebHashHistory } from 'vue-router';
import HomeView from './views/HomeView.vue';
import ResultView from './views/ResultView.vue';
import { hasSubmitted } from './config/api.js';

// 用 hash 路由，靜態主機（GitHub Pages）不用處理 404 轉址
export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'Home', component: HomeView },
    {
      path: '/result',
      name: 'Result',
      component: ResultView,
      // 送出過才能看大家的結果
      beforeEnter: () => (hasSubmitted() ? true : { path: '/' }),
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});
