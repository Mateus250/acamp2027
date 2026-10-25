// Rota GET /inscricoes (ou /api/inscricoes, /teste, /health) -> Teste de acesso e listagem
import { json } from '../utils/response.mjs';
import { log, logError } from '../utils/logger.mjs';
import { fetchInscricoes } from '../services/supabase.mjs';

export async function handleInscricoes(env, requestId) {
  log('INSCRICOES', `[${requestId}] Iniciando consulta de teste na tabela 'acampantes'...`);
  try {
    const inscricoes = await fetchInscricoes({
      supabaseUrl: env.SUPABASE_URL,
      authKey: env.supabaseReadAuthKey,
      requestId
    });

    log('INSCRICOES', `[${requestId}] Sucesso! Total de inscrições: ${Array.isArray(inscricoes) ? inscricoes.length : 0}`);

    return json(200, {
      ok: true,
      banco_conectado: true,
      total_inscricoes: Array.isArray(inscricoes) ? inscricoes.length : 0,
      configuracao: {
        supabase_url: env.SUPABASE_URL,
        supabase_service_role_ativa: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
        infinitepay_configurada: Boolean(env.INFINITEPAY_API_KEY),
        site_url: env.SITE_URL
      },
      inscricoes
    });
  } catch (err) {
    logError('INSCRICOES', `[${requestId}] Erro ao buscar inscrições:`, err);
    return json(500, {
      ok: false,
      banco_conectado: false,
      error: err.message,
      stack: err.stack
    });
  }
}
