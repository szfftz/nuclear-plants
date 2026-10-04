import { createApp } from 'vue';
import App from './App.vue';
import router from './router.js';
import { initAnalytics, trackPageView } from './lib/analytics.js';
import './assets/common.css';

initAnalytics();
router.afterEach((to) => trackPageView(to.fullPath));

createApp(App).use(router).mount('#app');
