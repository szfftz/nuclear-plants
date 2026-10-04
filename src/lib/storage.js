// cookie 與 localStorage 的小工具，key 都會加上專案前綴
const PREFIX = 'nuclear-plants_';
const COOKIE_DAYS = 365;

export const cookie = {
  get(name) {
    const match = document.cookie.split('; ').find((c) => c.startsWith(`${PREFIX}${name}=`));
    return match ? decodeURIComponent(match.split('=')[1]) : null;
  },
  set(name, value, days = COOKIE_DAYS) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${PREFIX}${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax${secure}`;
  },
};

export const local = {
  get(key) {
    try {
      return JSON.parse(localStorage.getItem(PREFIX + key));
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // 無痕模式等情況寫不進去，就算了
    }
  },
};
