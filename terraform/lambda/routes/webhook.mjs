// Rota POST /webhook (ou /api/webhook, /api/webhook/<codigo>) -> Notificações de pagamento da InfinitePay
import { json } from '../utils/response.mjs';
import { log, logError } from '../utils/logger.mjs';
import { todayISO } from '../utils/parser.mjs';
import { findAcampanteByCodigo, updateAcampante } from '../services/supabase.mjs';

export async function handleWebhook(body, env, requestId, pathCodigo = null) {
  log('WEBHOOK', `[${requestId}] === WEBHOOK RECEBIDO ===`, { pathCodigo, body });
  try {
    const eventType = body.event || body.type;
    const orderNsu = pathCodigo || body.order_nsu || body.orderId || body.reference;
    const amountPaid = body.paid_amount || body.amount;

    log('WEBHOOK', `[${requestId}] Extraído: event=${eventType}, order_nsu=${orderNsu} (fonte: ${pathCodigo ? 'path' : 'payload'}), amount=${amountPaid}`);

    // Só confirma a inscrição se for status de pagamento aprovado
    if (eventType !== 'paid' && eventType !== 'settled') {
      log('WEBHOOK', `[${requestId}] Evento ignorado (não é 'paid' ou 'settled'): ${eventType} para pedido ${orderNsu}`);
      return json(200, { ok: true, ignored: true, event: eventType, order_nsu: orderNsu });
    }

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
    const valorRecebido = Number(amountPaid) || (parcelas[0] ? parcelas[0].valor : 0);

    if (parcelas.length > 0) {
      parcelas[0].pago = valorRecebido;
      parcelas[0].dataPag = hoje;
    } else {
      parcelas.push({ n: 1, valor: valorRecebido, pago: valorRecebido, venc: hoje, dataPag: hoje });
    }

    log('WEBHOOK', `[${requestId}] Atualizando parcelas do acampante:`, parcelas);

    const updateRes = await updateAcampante({
      supabaseUrl: env.SUPABASE_URL,
      authKey: env.supabaseWriteAuthKey,
      codigo: orderNsu,
      updateData: {
        parcelas,
        obs: [acampante.obs, `Pago via InfinitePay (${body.capture_method || 'online'} - Ref: ${body.transaction_nsu || ''})`].filter(Boolean).join(' • ')
      },
      requestId
    });

    log('WEBHOOK_SUCCESS', `[${requestId}] Inscrição ${orderNsu} (${acampante.nome}) CONFIRMADA com valor de R$ ${(valorRecebido / 100).toFixed(2)}`);

    return json(200, {
      ok: true,
      message: 'Pagamento confirmado e inscrição atualizada com sucesso',
      order_nsu: orderNsu
    });
  } catch (err) {
    logError('WEBHOOK', `[${requestId}] Exceção não tratada ao processar webhook:`, err);
    return json(500, { error: err.message, stack: err.stack });
  }
}
