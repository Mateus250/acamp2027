// Rota GET /status (ou /api/status?codigo=IMR-XXXX ou ?documento=123...) -> Consulta status da inscrição
import { json } from '../utils/response.mjs';
import { log, logError } from '../utils/logger.mjs';
import { todayISO } from '../utils/parser.mjs';
import { findAcampanteByCodigo, findAcampanteByDocumento, updateAcampante } from '../services/supabase.mjs';
import { checkPaymentDirect } from '../services/infinitepay.mjs';

export async function handleStatus(queryStringParameters, env, requestId) {
  const codigo = queryStringParameters?.codigo;
  const documento = queryStringParameters?.documento || queryStringParameters?.cpf;
  log('STATUS', `[${requestId}] Consulta de status solicitada: codigo='${codigo || ''}', documento='${documento ? '***' : ''}'`);

  if (!codigo && !documento) {
    logError('STATUS', `[${requestId}] Nenhum parâmetro de busca ('codigo' ou 'documento') informado`);
    return json(400, { error: "Informe o parâmetro 'codigo' ou 'documento' na URL (ex: /api/status?codigo=IMR-XXXX ou ?documento=000.000.000-00)" });
  }

  try {
    let a = null;
    if (codigo) {
      a = await findAcampanteByCodigo({
        supabaseUrl: env.SUPABASE_URL,
        authKey: env.supabaseReadAuthKey,
        codigo,
        requestId
      });
    }

    if (!a && documento) {
      a = await findAcampanteByDocumento({
        supabaseUrl: env.SUPABASE_URL,
        authKey: env.supabaseReadAuthKey,
        documento,
        requestId
      });
    }

    if (!a) {
      logError('STATUS', `[${requestId}] Inscrição não foi encontrada no banco`);
      return json(404, { error: 'Inscrição não encontrada' });
    }

    const parcelas = Array.isArray(a.parcelas) ? a.parcelas : [];
    const total = parcelas.reduce((s, p) => s + (Number(p.valor) || 0), 0);
    const pago = parcelas.reduce((s, p) => s + (Number(p.pago) || 0), 0);
    let status = 'pendente';
    if (total > 0 && pago >= total) status = 'pago';
    else if (pago > 0) status = 'parcial';

    log('STATUS', `[${requestId}] Encontrado: Código='${a.codigo}', Nome='${a.nome}', Total=${total}, Pago=${pago}, Status='${status}'`);

    // Fallback: se ainda estiver pendente, pode checar na InfinitePay se temos API Key
    if (status !== 'pago' && env.INFINITEPAY_API_KEY && a.codigo) {
      log('STATUS', `[${requestId}] Status pendente: checando fallback na InfinitePay (/payment_check)...`);
      const checkData = await checkPaymentDirect({
        apiKey: env.INFINITEPAY_API_KEY,
        orderNsu: a.codigo,
        requestId
      });

      if (checkData && (checkData.paid || checkData.status === 'paid' || checkData.event === 'paid')) {
        status = 'pago';
        log('STATUS', `[${requestId}] Pagamento detectado na InfinitePay! Atualizando banco...`);
        if (parcelas.length > 0) {
          parcelas[0].pago = checkData.paid_amount || parcelas[0].valor;
          parcelas[0].dataPag = todayISO();
          await updateAcampante({
            supabaseUrl: env.SUPABASE_URL,
            authKey: env.supabaseWriteAuthKey,
            codigo: a.codigo,
            updateData: { parcelas },
            requestId
          });
        }
      }
    }

    return json(200, {
      codigo: a.codigo,
      nome: a.nome,
      lote: a.lote,
      camiseta: a.camiseta,
      email: a.email,
      telefone: a.telefone,
      total,
      pago,
      status,
      confirmado: status === 'pago'
    });
  } catch (err) {
    logError('STATUS', `[${requestId}] Exceção não tratada ao consultar status:`, err);
    return json(500, { error: err.message, stack: err.stack });
  }
}
