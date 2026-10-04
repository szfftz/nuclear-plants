import { createClient } from '@supabase/supabase-js';

// publishable key 本來就是給前端用的公開金鑰（資料由 RLS 保護），所以和 political-spectrum 一樣留預設值
const SUPABASE_URL = import.meta.env.NEXT_PUBLIC_SUPABASE_URL || 'https://idjdjhmqrdxunyolbqlp.supabase.co';
const SUPABASE_KEY =
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_RHCwlhmJ5yqO38dqxyYZcg_VjYldQzu';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 每人每座核電廠一列：cookie_id, name（核一～核四）, lat, lon, created_at, update_at
export const TABLE = 'data';
