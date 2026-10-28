// Rota POST /checkout (ou /api/checkout) -> Gera link de pagamento na InfinitePay
import { json } from '../utils/response.mjs';
import { log, logError } from '../utils/logger.mjs';
import { createCheckoutLink } from '../services/infinitepay.mjs';
import { findAcampanteByCodigo } from '../services/supabase.mjs';

function extractCpfFromObs(obs) {
  if (!obs || typeof obs !== 'string') return null;
  const match = obs.match(/CPF:\s*(\d{11})/i) || obs.match(/CPF:\s*([\d\.\-]{14})/i);
  return match ? match[1].replace(/\D/g, '') : null;
}

export async function handleCheckout(body, env, requestId) {
  log('CHECKOUT', `[${requestId}] Iniciando geração de link de checkout...`, body);
  let { codigo, nome, valor, email, telefone, phone, documento, cpf, customer } = body;

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

  // Tenta enriquecer os dados do cliente buscando no banco caso não tenham sido todos passados
  let docFinal = documento || cpf || (customer && (customer.document || customer.cpf));
  let emailFinal = email || (customer && customer.email);
  let telFinal = telefone || phone || (customer && (customer.phone || customer.phone_number));
  let nomeFinal = nome || (customer && customer.name);

  if ((!docFinal || !emailFinal || !telFinal) && env.SUPABASE_URL && env.supabaseReadAuthKey) {
    try {
      const acampante = await findAcampanteByCodigo({
        supabaseUrl: env.SUPABASE_URL,
        authKey: env.supabaseReadAuthKey,
        codigo,
        requestId
      });
      if (acampante) {
        nomeFinal = nomeFinal || acampante.nome;
        emailFinal = emailFinal || acampante.email;
        telFinal = telFinal || acampante.telefone;
        docFinal = docFinal || acampante.documento || extractCpfFromObs(acampante.obs);
        log('CHECKOUT', `[${requestId}] Dados recuperados do Supabase: Nome='${nomeFinal}', Email='${emailFinal}', CPF='${docFinal ? '***' : 'não encontrado'}'`);
      }
    } catch (e) {
      logError('CHECKOUT', `[${requestId}] Aviso ao buscar dados do acampante:`, e.message);
    }
  }

  const customerData = {
    name: nomeFinal,
    email: emailFinal,
    phone_number: telFinal,
    document: docFinal
  };

  try {
    const res = await createCheckoutLink({
      apiKey: env.INFINITEPAY_API_KEY,
      siteUrl: env.SITE_URL,
      codigo,
      nome: nomeFinal,
      valor,
      customer: customerData,
      webhookSecret: env.INFINITEPAY_WEBHOOK_SECRET,
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
