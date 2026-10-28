// Rota POST /webhook (ou /api/webhook, /api/webhook/<codigo>) -> Notificações de pagamento da InfinitePay
import { json } from '../utils/response.mjs';
import { log, logError } from '../utils/logger.mjs';
import { todayISO } from '../utils/parser.mjs';
import { findAcampanteByCodigo, updateAcampante } from '../services/supabase.mjs';
import { sendConfirmationEmail } from '../services/email.mjs';

export async function handleWebhook(body, env, requestId, pathCodigo = null) {
  log('WEBHOOK', `[${requestId}] === WEBHOOK RECEBIDO ===`, { pathCodigo, body });
  try {
    const eventType = body.event || body.type;
    const orderNsu = pathCodigo || body.order_nsu || body.orderId || body.reference;
    const amountPaid = body.paid_amount || body.amount;
    const captureMethod = body.capture_method || 'infinitepay';
    const transactionNsu = body.transaction_nsu || '';
    const receiptUrl = body.receipt_url || '';

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
