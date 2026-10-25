// Gerenciamento e mascaramento de variáveis de ambiente

export const DEFAULT_ANON_KEY = 'sb_publishable_stUBkyPTyqHtCla_seKJRw_k_LW2S_i';

export function maskSecret(val) {
  if (!val) return '[NÃO DEFINIDO / VAZIO]';
  if (val.length <= 8) return '********';
  return val.slice(0, 5) + '...' + val.slice(-4) + ` (tamanho: ${val.length})`;
}

export function getEnv() {
  const {
    INFINITEPAY_API_KEY = '',
    SUPABASE_URL = 'https://xhtnhhdpiuqdquacooau.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY = '',
    SITE_URL = 'https://acampimersos.com.br'
  } = process.env;

  const supabaseReadAuthKey = SUPABASE_SERVICE_ROLE_KEY || DEFAULT_ANON_KEY;
  const supabaseWriteAuthKey = SUPABASE_SERVICE_ROLE_KEY || DEFAULT_ANON_KEY;

  return {
    INFINITEPAY_API_KEY,
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    SITE_URL,
    supabaseReadAuthKey,
    supabaseWriteAuthKey
  };
}
