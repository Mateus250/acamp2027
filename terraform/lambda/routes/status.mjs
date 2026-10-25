// Rota GET /status (ou /api/status?codigo=IMR-XXXX ou ?documento=123...) -> Consulta status da inscrição
import { json } from '../utils/response.mjs';
import { log, logError } from '../utils/logger.mjs';
import { todayISO } from '../utils/parser.mjs';
import { findAcampanteByCodigo, findAcampanteByDocumento, updateAcampante } from '../services/supabase.mjs';
import { checkPaymentDirect } from '../services/infinitepay.mjs';

export async function handleStatus(queryStringParameters, env, requestId) {
  const codigo = queryStringParameters?.codigo;
  const documento = queryStringParameters?.documento || queryStringParameters?.cpf;
  const transactionNsu = queryStringParameters?.transaction_nsu || queryStringParameters?.nsu;
  const slug = queryStringParameters?.slug;
  const handle = queryStringParameters?.handle;

  log('STATUS', `[${requestId}] Consulta de status solicitada: codigo='${codigo || ''}', documento='${documento ? '***' : ''}', nsu='${transactionNsu || ''}'`);

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
      return json(200, { not_found: true, error: 'Inscrição não encontrada' });
    }

    let parcelas = Array.isArray(a.parcelas) ? a.parcelas.map(p => ({ ...p })) : [];
    let total = parcelas.reduce((s, p) => s + (Number(p.valor) || 0), 0);
    let pago = parcelas.reduce((s, p) => s + (Number(p.pago) || 0), 0);
    let status = 'pendente';
    if (total > 0 && pago >= total) status = 'pago';
    else if (pago > 0) status = 'parcial';

    log('STATUS', `[${requestId}] Situação no banco: Código='${a.codigo}', Nome='${a.nome}', Total=${total}, Pago=${pago}, Status='${status}'`);

    let checkedWithInfinitePay = false;
    let paymentInfo = null;

    // Se ainda não estiver totalmente pago, verifica direto na InfinitePay se o pagamento foi concluído com sucesso
    if (status !== 'pago' && env.INFINITEPAY_API_KEY && a.codigo) {
      log('STATUS', `[${requestId}] Verificando status na InfinitePay (/payment_check)...`);
      const checkData = await checkPaymentDirect({
        apiKey: env.INFINITEPAY_API_KEY,
        orderNsu: a.codigo,
        transactionNsu,
        slug,
        handle,
        requestId
      });

      if (checkData) {
        checkedWithInfinitePay = true;
        paymentInfo = checkData;

        if (checkData.paid) {
          log('STATUS', `[${requestId}] Pagamento aprovado na InfinitePay! Atualizando linha do acampante...`);
          const hoje = todayISO();
          const valorRecebido = Number(checkData.paid_amount) || Math.max(0, total - pago) || 43000;
          const captureMethod = checkData.capture_method || 'infinitepay';
          const nsu = checkData.transaction_nsu || transactionNsu || '';
          const receipt = checkData.receipt_url || '';

          if (parcelas.length === 0) {
            parcelas.push({
              n: 1,
              valor: valorRecebido,
              pago: valorRecebido,
              venc: hoje,
              dataPag: hoje,
              forma: captureMethod,
              comprovante: receipt || nsu
            });
          } else {
            // Tenta encontrar a parcela exata correspondente ao valor
            let targetIndex = parcelas.findIndex(p => {
              const devido = (Number(p.valor) || 0) - (Number(p.pago) || 0);
              return devido > 0 && devido === valorRecebido;
            });

            if (targetIndex >= 0) {
              parcelas[targetIndex].pago = (Number(parcelas[targetIndex].pago) || 0) + valorRecebido;
              parcelas[targetIndex].dataPag = hoje;
              parcelas[targetIndex].forma = captureMethod;
              if (receipt || nsu) parcelas[targetIndex].comprovante = receipt || nsu;
            } else {
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
                  if (receipt || nsu) parcelas[i].comprovante = receipt || nsu;
                  restante -= pagar;
                }
              }
            }
          }

          total = parcelas.reduce((s, p) => s + (Number(p.valor) || 0), 0);
          pago = parcelas.reduce((s, p) => s + (Number(p.pago) || 0), 0);
          status = total > 0 && pago >= total ? 'pago' : 'parcial';

          const comprovanteTxt = receipt ? ` - Recibo: ${receipt}` : '';
          const nsuTxt = nsu ? ` - NSU: ${nsu}` : '';
          const novaObs = [
            a.obs,
            `Confirmado via InfinitePay (${captureMethod}${nsuTxt}${comprovanteTxt}) em ${hoje}`
          ].filter(Boolean).join(' • ');

          await updateAcampante({
            supabaseUrl: env.SUPABASE_URL,
            authKey: env.supabaseWriteAuthKey,
            codigo: a.codigo,
            updateData: {
              parcelas,
              obs: novaObs
            },
            requestId
          });

          log('STATUS', `[${requestId}] Banco de dados atualizado com sucesso para 'pago'!`);
        }
      }
    }

    return json(200, {
      codigo: a.codigo,
      nome: a.nome,
      lote: a.lote,
      opcao_nome: a.opcao_nome || '',
      opcao_id: a.opcao_id || '',
      camiseta: a.camiseta,
      email: a.email,
      telefone: a.telefone,
      total,
      pago,
      status,
      confirmado: status === 'pago',
      parcelas,
      checked_with_infinitepay: checkedWithInfinitePay,
      receipt_url: paymentInfo?.receipt_url || null
    });
  } catch (err) {
    logError('STATUS', `[${requestId}] Exceção não tratada ao consultar status:`, err);
    return json(500, { error: err.message, stack: err.stack });
  }
}
