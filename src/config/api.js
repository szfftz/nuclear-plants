import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isRemote = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const supabase = isRemote ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const STORAGE_PREFIX = 'nuclear-plants_';
const TABLE = 'submissions';

const storage = {
  get(key) {
    try {
      return localStorage.getItem(STORAGE_PREFIX + key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, value);
    } catch {
      // 無痕模式等情況寫不進去，就算了
    }
  },
};

// 每個瀏覽器一個匿名 id，用來辨識「你的」點、並讓同一人只算最新一次
export const getUserId = () => {
  let id = storage.get('id');
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    storage.set('id', id);
  }
  return id;
};

export const hasSubmitted = () => storage.get('submitted') === '1';

// guesses: [[lon, lat] x 4]，依核一～核四排序
const toRow = (guesses) => {
  const row = { cookie_id: getUserId() };
  guesses.forEach(([lon, lat], i) => {
    row[`p${i + 1}_lon`] = +lon.toFixed(5);
    row[`p${i + 1}_lat`] = +lat.toFixed(5);
  });
  return row;
};

const fromRow = (row) => ({
  userId: row.cookie_id,
  createdAt: row.created_at,
  guesses: [1, 2, 3, 4].map((n) => [row[`p${n}_lon`], row[`p${n}_lat`]]),
});

const readLocalRows = () => {
  try {
    return JSON.parse(storage.get('rows') || '[]');
  } catch {
    return [];
  }
};

export const saveSubmission = async (guesses) => {
  const row = toRow(guesses);
  if (isRemote) {
    const { error } = await supabase.from(TABLE).insert(row);
    if (error) throw new Error(error.message);
  } else {
    storage.set('rows', JSON.stringify([...readLocalRows(), { ...row, created_at: new Date().toISOString() }]));
  }
  storage.set('submitted', '1');
};

const fetchAllRows = async () => {
  if (!isRemote) return readLocalRows();
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows;
};

// 每人只取最新一次作答
export const fetchSubmissions = async () => {
  const latest = new Map();
  (await fetchAllRows()).forEach((row) => latest.set(row.cookie_id, row));
  return [...latest.values()].map(fromRow);
};
