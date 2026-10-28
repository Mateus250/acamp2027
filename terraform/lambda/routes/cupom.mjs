// Rota GET /cupom (ou /api/cupom?codigo=XYZ) -> Validação segura de cupom no servidor
import { json } from '../utils/response.mjs';
import { log, logError } from '../utils/logger.mjs';
import { validateCupom } from '../services/supabase.mjs';

export async function handleCupom(queryParams, env, requestId) {
  const codigo = queryParams?.codigo || queryParams?.code;
  if (!codigo) {
    return json(400, { ok: false, error: 'Código do cupom é obrigatório' });
  }

  log('ROUTE_CUPOM', `[${requestId}] Validando cupom '${codigo}' via API...`);

  try {
    const cupom = await validateCupom({
      supabaseUrl: env.SUPABASE_URL,
      authKey: env.supabaseReadAuthKey,
      codigo,
      requestId
    });

    if (!cupom || cupom.invalid) {
      log('ROUTE_CUPOM', `[${requestId}] Cupom '${codigo}' inválido ou não encontrado: ${cupom?.reason || 'não existe'}`);
      return json(200, {
        ok: false,
        error: cupom?.reason || 'Cupom não encontrado. Confira com a liderança da sua igreja.'
      });
    }

    log('ROUTE_CUPOM', `[${requestId}] Cupom '${codigo}' validado com sucesso: Igreja='${cupom.church}', Tipo='${cupom.type}', Valor=${cupom.value}`);
    return json(200, {
      ok: true,
      cupom
    });
  } catch (err) {
    logError('ROUTE_CUPOM_ERR', `[${requestId}] Erro ao validar cupom:`, err);
    return json(500, { ok: false, error: 'Erro ao validar cupom no servidor.' });
  }
}
