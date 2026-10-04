import { createClient } from '@supabase/supabase-js';
import { PLANTS } from './plants.js';

// publishable key 本來就是給前端用的公開金鑰（資料由 RLS 保護），所以和 political-spectrum 一樣留預設值
const SUPABASE_URL = import.meta.env.NEXT_PUBLIC_SUPABASE_URL || 'https://idjdjhmqrdxunyolbqlp.supabase.co';
const SUPABASE_KEY =
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_RHCwlhmJ5yqO38dqxyYZcg_VjYldQzu';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TABLE = 'data';
const PREFIX = 'nuclear-plants_';
const UNIQUE_VIOLATION = '23505';

const cookie = {
  get(name) {
    const match = document.cookie.split('; ').find((c) => c.startsWith(`${PREFIX}${name}=`));
    return match ? decodeURIComponent(match.split('=')[1]) : null;
  },
  set(name, value, days = 365) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${PREFIX}${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax${secure}`;
  },
};

const local = {
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

// 每個瀏覽器一個匿名 id，存在 cookie（同 political-spectrum）
export const getCookieId = () => {
  let id = cookie.get('id');
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    cookie.set('id', id);
  }
  return id;
};

// 「有送出」＝資料庫裡已經有這個 cookie_id 的資料。cookie 只當快取，真正以資料庫為準
export const hasSubmitted = () => cookie.get('submitted') === '1';

export const checkUploaded = async () => {
  const { data, error } = await supabase.from(TABLE).select('id').eq('cookie_id', getCookieId()).limit(1);
  if (error) return hasSubmitted(); // 連不上就先相信 cookie
  const uploaded = data.length > 0;
  cookie.set('submitted', uploaded ? '1' : '0');
  return uploaded;
};

// 這台裝置最近一次的作答：{ guesses: [[lon, lat] x 4], update_at }
export const getLocalAnswer = () => local.get('answer');

const markSubmitted = (createdAt) => {
  cookie.set('submitted', '1');
  if (createdAt) cookie.set('created_at', createdAt);
};

/**
 * 送出作答。每人只上傳一次：
 * - 第一次 → 寫入 Supabase（四列），回傳 'uploaded'
 * - 之後   → 只存 localStorage，回傳 'local'
 * guesses：[[lon, lat] x 4]，依核一～核四排序
 */
export const submitAnswer = async (guesses) => {
  const now = new Date().toISOString();
  local.set('answer', { guesses, update_at: now });

  if (await checkUploaded()) return 'local';

  const cookieId = getCookieId();
  const rows = PLANTS.map((plant, i) => ({
    cookie_id: cookieId,
    name: plant.label,
    lon: +guesses[i][0].toFixed(5),
    lat: +guesses[i][1].toFixed(5),
  }));

  const { error } = await supabase.from(TABLE).insert(rows);
  if (error) {
    // 已經上傳過（例如 cookie 的 submitted 被清掉但 id 還在）
    if (error.code === UNIQUE_VIOLATION) {
      markSubmitted();
      return 'local';
    }
    throw new Error(error.message);
  }
  markSubmitted(now);
  return 'uploaded';
};

const fetchAllRows = async () => {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('cookie_id, name, lat, lon, update_at')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows;
};

// 所有人上傳的作答，依 cookie_id 合併成 { cookieId, guesses }，只留四座都有的
export const fetchSubmissions = async () => {
  const byUser = new Map();
  (await fetchAllRows()).forEach((row) => {
    const index = PLANTS.findIndex((p) => p.label === row.name);
    if (index < 0) return;
    if (!byUser.has(row.cookie_id)) byUser.set(row.cookie_id, { cookieId: row.cookie_id, guesses: [] });
    byUser.get(row.cookie_id).guesses[index] = [row.lon, row.lat];
  });
  return [...byUser.values()].filter((s) => PLANTS.every((_, i) => s.guesses[i]));
};

// 這台裝置上次的作答：先看 localStorage（第一次之後的改動都在這），沒有再用資料庫裡上傳的那筆
export const fetchMyAnswer = async () => {
  const localAnswer = getLocalAnswer();
  if (localAnswer?.guesses?.length === PLANTS.length) return localAnswer.guesses;
  const { data, error } = await supabase.from(TABLE).select('name, lat, lon').eq('cookie_id', getCookieId());
  if (error || !data) return null;
  const guesses = PLANTS.map((p) => data.find((row) => row.name === p.label)).map((row) => row && [row.lon, row.lat]);
  return guesses.every(Boolean) ? guesses : null;
};

// 參與人數：每人上傳四列（核一～核四）
export const fetchParticipantCount = async () => {
  const { count, error } = await supabase.from(TABLE).select('id', { count: 'exact', head: true });
  if (error) throw new Error(error.message);
  return Math.floor((count ?? 0) / PLANTS.length);
};
