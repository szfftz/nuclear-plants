// 作答資料的讀寫。每人只上傳一次（資料庫用 unique(cookie_id, name) 擋），之後的作答只存在 localStorage。
import { supabase, TABLE } from '../config/supabase.js';
import { PLANTS } from '../config/plants.js';
import { cookie, local } from '../lib/storage.js';

const UNIQUE_VIOLATION = '23505';
const PAGE_SIZE = 1000;

// 每個瀏覽器一個匿名 id，存在 cookie（同 political-spectrum）
export const getCookieId = () => {
  let id = cookie.get('id');
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    cookie.set('id', id);
  }
  return id;
};

const setSubmittedCookie = (uploaded) => cookie.set('submitted', uploaded ? '1' : '0');

// 本機開發：不寫資料庫，也不用送出就能看結果
export const isLocalhost = ['localhost', '127.0.0.1'].includes(location.hostname);

// 「有送出」＝資料庫裡已經有這個 cookie_id 的資料。cookie 只當快取，真正以資料庫為準
export const hasSubmitted = () => cookie.get('submitted') === '1';

export const checkUploaded = async () => {
  const { data, error } = await supabase.from(TABLE).select('id').eq('cookie_id', getCookieId()).limit(1);
  if (error) return hasSubmitted(); // 連不上就先相信 cookie
  const uploaded = data.length > 0;
  setSubmittedCookie(uploaded);
  return uploaded;
};

// 這台裝置最近一次的作答：{ guesses: [[lon, lat] x 4], update_at }
export const getLocalAnswer = () => local.get('answer');

// 同一人的資料列（核一～核四各一列）→ [[lon, lat] x 4]；少了任何一座就回傳 null
const rowsToGuesses = (rows) => {
  const guesses = PLANTS.map((plant) => {
    const row = rows.find((r) => r.name === plant.label);
    return row ? [row.lon, row.lat] : null;
  });
  return guesses.every(Boolean) ? guesses : null;
};

/**
 * 送出作答（guesses：[[lon, lat] x 4]，依核一～核四排序）
 * - 資料庫還沒有這個人 → 寫入四列，回傳 'uploaded'
 * - 已經有了           → 只存 localStorage，回傳 'local'
 * - 本機開發           → 不寫資料庫，只存 localStorage，回傳 'local'
 */
export const submitAnswer = async (guesses) => {
  local.set('answer', { guesses, update_at: new Date().toISOString() });
  if (isLocalhost) return 'local';

  if (await checkUploaded()) return 'local';

  const cookieId = getCookieId();
  const rows = PLANTS.map((plant, i) => ({
    cookie_id: cookieId,
    name: plant.label,
    lon: +guesses[i][0].toFixed(5),
    lat: +guesses[i][1].toFixed(5),
  }));

  const { error } = await supabase.from(TABLE).insert(rows);
  if (error && error.code !== UNIQUE_VIOLATION) throw new Error(error.message);
  setSubmittedCookie(true);
  // 撞到唯一鍵＝其實已經上傳過了
  return error ? 'local' : 'uploaded';
};

const fetchAllRows = async () => {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('cookie_id, name, lat, lon')
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
};

// 所有人上傳的作答：[{ cookieId, guesses }]，只留四座都有的
export const fetchSubmissions = async () => {
  const rowsByUser = new Map();
  for (const row of await fetchAllRows()) {
    if (!rowsByUser.has(row.cookie_id)) rowsByUser.set(row.cookie_id, []);
    rowsByUser.get(row.cookie_id).push(row);
  }
  return [...rowsByUser]
    .map(([cookieId, rows]) => ({ cookieId, guesses: rowsToGuesses(rows) }))
    .filter((s) => s.guesses);
};

// 這台裝置上次的作答：先看 localStorage（第一次之後的改動都在這），沒有再用資料庫裡上傳的那筆
export const fetchMyAnswer = async () => {
  const localAnswer = getLocalAnswer();
  if (localAnswer?.guesses?.length === PLANTS.length) return localAnswer.guesses;
  const { data, error } = await supabase.from(TABLE).select('name, lat, lon').eq('cookie_id', getCookieId());
  if (error || !data) return null;
  return rowsToGuesses(data);
};

// 參與人數：每人上傳四列（核一～核四）
export const fetchParticipantCount = async () => {
  const { count, error } = await supabase.from(TABLE).select('id', { count: 'exact', head: true });
  if (error) throw new Error(error.message);
  return Math.floor((count ?? 0) / PLANTS.length);
};
