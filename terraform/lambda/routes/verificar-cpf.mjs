// Rota GET /verificar-cpf (ou /api/verificar-cpf?cpf=123...) -> Checagem de duplicidade de CPF sem expor dados sensíveis
import { json } from '../utils/response.mjs';
import { log, logError } from '../utils/logger.mjs';
import { findAcampanteByDocumento } from '../services/supabase.mjs';

export async function handleVerificarCpf(queryParams, env, requestId) {
  const rawDoc = queryParams?.cpf || queryParams?.documento;
  const digits = String(rawDoc || '').replace(/\D/g, '');

  if (!digits || digits.length !== 11) {
    return json(400, { exists: false, error: 'CPF inválido ou não informado' });
  }

  log('ROUTE_VERIFICA_CPF', `[${requestId}] Checando se CPF já está cadastrado...`);

  try {
    const acampante = await findAcampanteByDocumento({
      supabaseUrl: env.SUPABASE_URL,
      authKey: env.supabaseReadAuthKey,
      documento: digits,
      requestId
    });

    if (acampante) {
      log('ROUTE_VERIFICA_CPF', `[${requestId}] CPF encontrado para inscrição ${acampante.codigo} (${acampante.nome})`);
      return json(200, {
        exists: true,
        jaInscrito: {
          nome: acampante.nome,
          codigo: acampante.codigo
        }
      });
    }

    return json(200, { exists: false });
  } catch (err) {
    logError('ROUTE_VERIFICA_CPF_ERR', `[${requestId}] Erro ao verificar CPF:`, err);
    return json(500, { exists: false, error: 'Erro ao verificar CPF no servidor' });
  }
}
