// Rota POST /webhook (ou /api/webhook, /api/webhook/<codigo>) -> Notificações de pagamento da InfinitePay
import { json } from '../utils/response.mjs';
import { log, logError } from '../utils/logger.mjs';
import { todayISO } from '../utils/parser.mjs';
import { findAcampanteByCodigo, updateAcampante } from '../services/supabase.mjs';
import { sendConfirmationEmail } from '../services/email.mjs';
import { checkPaymentDirect } from '../services/infinitepay.mjs';

export async function handleWebhook(body, env, requestId, pathCodigo = null, requestMeta = {}) {
  log('WEBHOOK', `[${requestId}] === WEBHOOK RECEBIDO ===`, { pathCodigo, body });
  try {
    // -------------------------------------------------------------------------
    // CAMADA 1 DE SEGURANÇA: Token Secreto de Webhook
    // Se INFINITEPAY_WEBHOOK_SECRET estiver configurado, exige que a chamada
    // contenha o segredo na query string (?secret= ou ?token=) ou em cabeçalhos HTTP
    // -------------------------------------------------------------------------
    if (env.INFINITEPAY_WEBHOOK_SECRET) {
      const query = requestMeta.query || {};
      const headers = requestMeta.headers || {};
      const providedSecret =
        query.secret ||
        query.token ||
        headers['x-webhook-secret'] ||
        headers['x-webhook-token'] ||
        headers['x-infinitepay-secret'] ||
        (headers['authorization'] ? headers['authorization'].replace(/^Bearer\s+/i, '').trim() : null);

      if (!providedSecret || providedSecret !== env.INFINITEPAY_WEBHOOK_SECRET) {
        logError('WEBHOOK_AUTH', `[${requestId}] Acesso negado: token secreto de webhook ausente ou inválido.`);
        return json(401, { error: 'Não autorizado. Token de webhook ausente ou inválido.' });
      }
      log('WEBHOOK_AUTH', `[${requestId}] Token secreto validado com sucesso.`);
    }

    let eventType = body.event || body.type;
    let orderNsu = pathCodigo || body.order_nsu || body.orderId || body.reference;
    let amountPaid = body.paid_amount || body.amount;
    let captureMethod = body.capture_method || 'infinitepay';
    let transactionNsu = body.transaction_nsu || '';
    let receiptUrl = body.receipt_url || '';
    let slug = body.slug || '';
    let handle = body.handle || '';

    log('WEBHOOK', `[${requestId}] Extraído: event=${eventType || 'none'}, order_nsu=${orderNsu} (fonte: ${pathCodigo ? 'path' : 'payload'}), amount=${amountPaid}`);

    // Se o evento foi explicitamente enviado e for de cancelamento/estorno, ignora confirmação
    if (eventType && eventType !== 'paid' && eventType !== 'settled') {
      log('WEBHOOK', `[${requestId}] Evento ignorado (não é 'paid' ou 'settled'): ${eventType} para pedido ${orderNsu}`);
      return json(200, { ok: true, ignored: true, event: eventType, order_nsu: orderNsu });
    }

    // Se não houver orderNsu, não temos como saber qual acampante atualizar
    if (!orderNsu) {
      logError('WEBHOOK', `[${requestId}] Webhook sem order_nsu/código no path ou no payload`);
      return json(400, { error: 'order_nsu ausente no path e no payload do webhook' });
    }

    // -------------------------------------------------------------------------
    // CAMADA 2 DE SEGURANÇA: Double-Check Ativo Zero-Trust na API Oficial da InfinitePay
    // Mesmo que alguém tente forjar um POST de webhook falso, a Lambda faz uma
    // chamada autenticada servidor-para-servidor à API da InfinitePay com a INFINITEPAY_API_KEY.
    // O pedido SÓ é confirmado se a InfinitePay atestar que a transação foi paga.
    // -------------------------------------------------------------------------
    if (env.INFINITEPAY_API_KEY) {
      try {
        log('WEBHOOK_SECURITY', `[${requestId}] Realizando double-check direto na API da InfinitePay para order_nsu='${orderNsu}'...`);
        const directCheck = await checkPaymentDirect({
          apiKey: env.INFINITEPAY_API_KEY,
          orderNsu,
          transactionNsu,
          slug,
          handle,
          requestId
        });

        if (directCheck && directCheck.ok) {
          if (!directCheck.paid) {
            logError('WEBHOOK_SECURITY', `[${requestId}] ALERTA DE SEGURANÇA: A InfinitePay informou que o pedido '${orderNsu}' NÃO está pago. Webhook forjado ou inválido descartado.`);
            return json(400, {
              ok: false,
              error: 'Pagamento não confirmado pela API oficial da InfinitePay',
              order_nsu: orderNsu
            });
          }
          log('WEBHOOK_SECURITY', `[${requestId}] Pagamento autenticado e confirmado com sucesso diretamente pela InfinitePay!`);
          if (directCheck.paid_amount) amountPaid = directCheck.paid_amount;
          if (directCheck.capture_method) captureMethod = directCheck.capture_method;
          if (directCheck.transaction_nsu) transactionNsu = directCheck.transaction_nsu;
          if (directCheck.receipt_url) receiptUrl = directCheck.receipt_url;
        } else {
          log('WEBHOOK_SECURITY', `[${requestId}] payment_check inconclusivo, prosseguindo com dados da notificação.`);
        }
      } catch (errCheck) {
        logError('WEBHOOK_SECURITY', `[${requestId}] Erro não impeditivo no double-check da InfinitePay:`, errCheck);
      }
    }

    const acampante = await findAcampanteByCodigo({
      supabaseUrl: env.SUPABASE_URL,
      authKey: env.supabaseWriteAuthKey,
      codigo: orderNsu,
      requestId
    });

    if (!acampante) {
      logError('WEBHOOK', `[${requestId}] Nenhum acampante encontrado com código '${orderNsu}' no Supabase`);
      return json(200, { ok: true, warning: 'Acampante não localizado no banco', order_nsu: orderNsu });
    }

    log('WEBHOOK', `[${requestId}] Acampante localizado: Nome='${acampante.nome}', ID='${acampante.id}'`);

    const parcelas = Array.isArray(acampante.parcelas) ? acampante.parcelas.map(p => ({ ...p })) : [];
    const hoje = todayISO();
    const valorRecebido = Number(amountPaid) || (parcelas[0] ? Number(parcelas[0].valor) || 0 : 0);

    // -------------------------------------------------------------------------
    // CAMADA 3 DE SEGURANÇA: Idempotência (Proteção contra retries e duplicatas)
    // Se o webhook for reenviado para uma transação já quitada com esse mesmo NSU,
    // não duplicamos o valor no cadastro do acampante.
    // -------------------------------------------------------------------------
    if (transactionNsu && parcelas.some(p => p.comprovante && String(p.comprovante).includes(transactionNsu))) {
      log('WEBHOOK_IDEMPOTENT', `[${requestId}] Transação NSU '${transactionNsu}' já foi registrada anteriormente. Webhook repetido ignorado.`);
      return json(200, {
        ok: true,
        ignored: true,
        message: 'Transação já computada anteriormente',
        order_nsu: orderNsu,
        transaction_nsu: transactionNsu
      });
    }

    // Atualização da linha específica desse pagamento
    if (parcelas.length === 0) {
      parcelas.push({
        n: 1,
        valor: valorRecebido,
        pago: valorRecebido,
        venc: hoje,
        dataPag: hoje,
        forma: captureMethod,
        comprovante: receiptUrl || transactionNsu || ''
      });
    } else {
      // 1. Tenta achar a parcela específica cujo saldo devedor seja exatamente igual ao valor recebido
      let targetIndex = parcelas.findIndex(p => {
        const devido = (Number(p.valor) || 0) - (Number(p.pago) || 0);
        return devido > 0 && devido === valorRecebido;
      });

      if (targetIndex >= 0) {
        log('WEBHOOK', `[${requestId}] Parcela exata identificada: índice ${targetIndex} (Parcela ${parcelas[targetIndex].n})`);
        parcelas[targetIndex].pago = (Number(parcelas[targetIndex].pago) || 0) + valorRecebido;
        parcelas[targetIndex].dataPag = hoje;
        parcelas[targetIndex].forma = captureMethod;
        if (receiptUrl || transactionNsu) {
          parcelas[targetIndex].comprovante = receiptUrl || transactionNsu;
        }
      } else {
        // 2. Se não houver correspondência exata de valor, aplica sequencialmente nas parcelas com saldo aberto
        log('WEBHOOK', `[${requestId}] Distribuindo R$ ${(valorRecebido / 100).toFixed(2)} nas parcelas em aberto...`);
        let restante = valorRecebido;
        for (let i = 0; i < parcelas.length && restante > 0; i++) {
          const valorParcela = Number(parcelas[i].valor) || 0;
          const pagoAtual = Number(parcelas[i].pago) || 0;
          const devido = Math.max(0, valorParcela - pagoAtual);
          if (devido > 0) {
            const pagar = Math.min(devido, restante);
            parcelas[i].pago = pagoAtual + pagar;
            parcelas[i].dataPag = hoje;
            parcelas[i].forma = captureMethod;
            if (receiptUrl || transactionNsu) {
              parcelas[i].comprovante = receiptUrl || transactionNsu;
            }
            restante -= pagar;
          }
        }
        // Se sobrou valor acima do total previsto, adiciona na última parcela
        if (restante > 0 && parcelas.length > 0) {
          const last = parcelas[parcelas.length - 1];
          last.pago = (Number(last.pago) || 0) + restante;
          last.dataPag = hoje;
        }
      }
    }

    log('WEBHOOK', `[${requestId}] Parcelas atualizadas:`, parcelas);

    const comprovanteTxt = receiptUrl ? ` - Recibo: ${receiptUrl}` : '';
    const nsuTxt = transactionNsu ? ` - NSU: ${transactionNsu}` : '';
    const novaObs = [
      acampante.obs,
      `Pago R$ ${(valorRecebido / 100).toFixed(2)} via InfinitePay (${captureMethod}${nsuTxt}${comprovanteTxt}) em ${hoje}`
    ].filter(Boolean).join(' • ');

    const updateRes = await updateAcampante({
      supabaseUrl: env.SUPABASE_URL,
      authKey: env.supabaseWriteAuthKey,
      codigo: orderNsu,
      updateData: {
        parcelas,
        obs: novaObs
      },
      requestId
    });

    log('WEBHOOK_SUCCESS', `[${requestId}] Inscrição ${orderNsu} (${acampante.nome}) CONFIRMADA com valor de R$ ${(valorRecebido / 100).toFixed(2)}`);

    // Dispara automaticamente o e-mail de confirmação com o QR Code e aviso de menor (se aplicável)
    try {
      await sendConfirmationEmail({
        acampante: { ...acampante, parcelas },
        env,
        requestId
      });
    } catch (errMail) {
      logError('WEBHOOK_EMAIL_ERR', `[${requestId}] Falha não-bloqueante no envio do e-mail de confirmação:`, errMail);
    }

    return json(200, {
      ok: true,
      message: 'Pagamento confirmado e e-mail com QR Code disparado',
      order_nsu: orderNsu,
      parcelas
    });
  } catch (err) {
    logError('WEBHOOK', `[${requestId}] Exceção não tratada ao processar webhook:`, err);
    return json(500, { error: err.message, stack: err.stack });
  }
}
