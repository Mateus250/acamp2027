// Rota POST /checkout (ou /api/checkout) -> Gera link de pagamento na InfinitePay
import { json } from '../utils/response.mjs';
import { log, logError } from '../utils/logger.mjs';
import { createCheckoutLink } from '../services/infinitepay.mjs';

export async function handleCheckout(body, env, requestId) {
  log('CHECKOUT', `[${requestId}] Iniciando geração de link de checkout...`, body);
  const { codigo, nome, valor } = body;

  if (!codigo || !valor) {
    logError('CHECKOUT', `[${requestId}] Validação falhou: codigo ou valor ausentes`, { codigo, valor });
    return json(400, { error: 'codigo e valor (em centavos) são obrigatórios.' });
  }

  if (!env.INFINITEPAY_API_KEY) {
    logError('CHECKOUT', `[${requestId}] INFINITEPAY_API_KEY não configurada`);
    return json(500, {
      error: 'INFINITEPAY_API_KEY não configurada no backend.',
      dica: 'Adicione a secret INFINITEPAY_API_KEY no GitHub Secrets ou no Terraform.'
    });
  }

  try {
    const res = await createCheckoutLink({
      apiKey: env.INFINITEPAY_API_KEY,
      siteUrl: env.SITE_URL,
      codigo,
      nome,
      valor,
      requestId
    });

    if (!res.ok) {
      return json(res.status || 500, {
        error: 'Erro retornado pela InfinitePay',
        status: res.status,
        details: res.data
      });
    }

    log('CHECKOUT', `[${requestId}] Link gerado com sucesso: ${res.url}`);
    return json(200, {
      ok: true,
      url: res.url,
      order_nsu: codigo,
      raw: res.raw
    });
  } catch (err) {
    logError('CHECKOUT', `[${requestId}] Exceção no fluxo de checkout:`, err);
    return json(500, { error: err.message, stack: err.stack });
  }
}
