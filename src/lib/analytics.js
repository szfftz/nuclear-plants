// Google Analytics（gtag.js）。沒有設定 ID 時什麼都不做。
// 評估 ID 會公開在網頁上，不是機密；.env 的 NEXT_PUBLIC_GA_ID 可以覆蓋
const GA_ID = import.meta.env.NEXT_PUBLIC_GA_ID || 'G-N7DMV350L1';

const enabled = () => Boolean(GA_ID) && typeof window !== 'undefined';

export const initAnalytics = () => {
  if (!enabled() || window.gtag) return;
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  // hash 路由換頁時不會自動送 page_view，改由 trackPageView 手動送
  window.gtag('config', GA_ID, { send_page_view: false });
};

export const trackPageView = (path) => {
  if (!enabled() || !window.gtag) return;
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
};

export const trackEvent = (name, params = {}) => {
  if (!enabled() || !window.gtag) return;
  window.gtag('event', name, params);
};
