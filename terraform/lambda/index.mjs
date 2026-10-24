// Lambda Function para Checkout e Webhook da InfinitePay
// Acampamento IMERSOS 2027

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key, Authorization',
  'Content-Type': 'application/json'
};

function parseBody(event) {
  if (!event.body) return {};
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf-8')
      : event.body;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (err) {
    console.error('Erro ao fazer parse do body:', err);
    return {};
  }
}

function getPath(event) {
  const p = event.rawPath || (event.requestContext && event.requestContext.http && event.requestContext.http.path) || '/';
  return p.replace(/^\/api/, ''); // remove prefixo /api se presente
}

function todayISO() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

export const handler = async (event) => {
  const method = (event.requestContext?.http?.method || event.httpMethod || 'GET').toUpperCase();
  const path = getPath(event);

  console.log(`[API] ${method} ${path}`);

  // Resposta para pre-flight CORS
  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ ok: true })
    };
  }

  const {
    INFINITEPAY_API_KEY,
    SUPABASE_URL = 'https://xhtnhhdpiuqdquacooau.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY,
    SITE_URL = 'https://acampimersos.com.br'
  } = process.env;

  // -------------------------------------------------------------------------
  // 1. POST /checkout (ou /api/checkout) -> Cria link na API da InfinitePay
  // -------------------------------------------------------------------------
  if (method === 'POST' && (path === '/checkout' || path === '')) {
    try {
      const body = parseBody(event);
      const { codigo, nome, valor, email, telefone } = body;

      if (!codigo || !valor) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'codigo e valor (em centavos) são obrigatórios.' })
        };
      }

      if (!INFINITEPAY_API_KEY) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'INFINITEPAY_API_KEY não configurada no backend.' })
        };
      }

      const redirectUrl = `${SITE_URL}/checkout.html?codigo=${encodeURIComponent(codigo)}&status=concluido`;
      const webhookUrl = `${SITE_URL}/api/webhook`;

      const payload = {
        order_nsu: codigo,
        redirect_url: redirectUrl,
        single_payment: true,
        payment_methods_enabled: ['pix', 'credit_card'],
        items: [
          {
            name: `Inscrição Imersos 2027 (${(nome || codigo).slice(0, 35)})`,
            quantity: 1,
            price: Number(valor)
          }
        ],
        webhook: {
          url: webhookUrl,
          events: ['paid', 'settled']
        }
      };

      console.log('Chamando InfinitePay /links para pedido:', codigo, payload);

      const resp = await fetch('https://api.checkout.infinitepay.io/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': INFINITEPAY_API_KEY
        },
        body: JSON.stringify(payload)
      });

      const resData = await resp.json();
      console.log('Resposta InfinitePay:', resp.status, resData);

      if (!resp.ok) {
        return {
          statusCode: resp.status,
          headers: corsHeaders,
          body: JSON.stringify({
            error: 'Erro retornado pela InfinitePay',
            details: resData
          })
        };
      }

      const checkoutUrl = resData.url || resData.link || (resData.data && (resData.data.url || resData.data.link));

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          ok: true,
          url: checkoutUrl,
          order_nsu: codigo,
          raw: resData
        })
      };
    } catch (err) {
      console.error('Erro no checkout:', err);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: err.message })
      };
    }
  }

  // -------------------------------------------------------------------------
  // 2. POST /webhook (ou /api/webhook) -> Recebe notificação da InfinitePay
  // -------------------------------------------------------------------------
  if (method === 'POST' && path === '/webhook') {
    try {
      const body = parseBody(event);
      console.log('[WEBHOOK INFINITEPAY RECEBIDO]:', JSON.stringify(body));

      const eventType = body.event || body.type;
      const orderNsu = body.order_nsu || body.orderId || body.reference;
      const amountPaid = body.paid_amount || body.amount;

      // Só confirma a inscrição se for status de pagamento aprovado
      if (eventType !== 'paid' && eventType !== 'settled') {
        console.log(`Evento ignorado (${eventType}) para order: ${orderNsu}`);
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ ok: true, ignored: true, event: eventType })
        };
      }

      if (!orderNsu) {
        console.warn('Webhook recebido sem order_nsu');
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'order_nsu ausente no payload' })
        };
      }

      if (!SUPABASE_SERVICE_ROLE_KEY) {
        console.error('SUPABASE_SERVICE_ROLE_KEY ausente.');
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Configuração do Supabase incompleta' })
        };
      }

      // Busca o acampante no Supabase pelo código da inscrição
      const searchUrl = `${SUPABASE_URL}/rest/v1/acampantes?codigo=eq.${encodeURIComponent(orderNsu)}&select=*`;
      const searchRes = await fetch(searchUrl, {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      });

      const acampantes = await searchRes.json();
      if (!Array.isArray(acampantes) || acampantes.length === 0) {
        console.warn(`Nenhum acampante encontrado com código: ${orderNsu}`);
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ ok: true, warning: 'Acampante não localizado' })
        };
      }

      const acampante = acampantes[0];
      const parcelas = Array.isArray(acampante.parcelas) ? acampante.parcelas.map(p => ({ ...p })) : [];

      // Marca o valor pago na parcela correspondente
      const hoje = todayISO();
      const valorRecebido = Number(amountPaid) || (parcelas[0] ? parcelas[0].valor : 0);

      if (parcelas.length > 0) {
        parcelas[0].pago = valorRecebido;
        parcelas[0].dataPag = hoje;
      } else {
        parcelas.push({ n: 1, valor: valorRecebido, pago: valorRecebido, venc: hoje, dataPag: hoje });
      }

      // Atualiza a linha no Supabase
      const updateUrl = `${SUPABASE_URL}/rest/v1/acampantes?codigo=eq.${encodeURIComponent(orderNsu)}`;
      const updateRes = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
        body: JSON.stringify({
          parcelas,
          obs: [acampante.obs, `Pago via InfinitePay (${body.capture_method || 'online'} - Ref: ${body.transaction_nsu || ''})`].filter(Boolean).join(' • ')
        })
      });

      console.log(`[SUCESSO] Inscrição ${orderNsu} confirmada com pagamento de R$ ${(valorRecebido / 100).toFixed(2)}`);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          ok: true,
          message: 'Pagamento confirmado e inscrição atualizada com sucesso',
          order_nsu: orderNsu
        })
      };
    } catch (err) {
      console.error('Erro ao processar webhook:', err);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: err.message })
      };
    }
  }

  // -------------------------------------------------------------------------
  // 3. GET /status (ou /api/status?codigo=IMR-XXXX) -> Consulta status da inscrição
  // -------------------------------------------------------------------------
  if (method === 'GET' && path === '/status') {
    try {
      const params = event.queryStringParameters || {};
      const codigo = params.codigo;

      if (!codigo) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Parâmetro codigo é obrigatório' })
        };
      }

      const searchUrl = `${SUPABASE_URL}/rest/v1/acampantes?codigo=eq.${encodeURIComponent(codigo)}&select=*`;
      const searchRes = await fetch(searchUrl, {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      });

      const acampantes = await searchRes.json();
      if (!Array.isArray(acampantes) || acampantes.length === 0) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Inscrição não encontrada' })
        };
      }

      const a = acampantes[0];
      const parcelas = Array.isArray(a.parcelas) ? a.parcelas : [];
      const total = parcelas.reduce((s, p) => s + (Number(p.valor) || 0), 0);
      const pago = parcelas.reduce((s, p) => s + (Number(p.pago) || 0), 0);
      let status = 'pendente';
      if (total > 0 && pago >= total) status = 'pago';
      else if (pago > 0) status = 'parcial';

      // Fallback: se ainda estiver pendente, pode checar na InfinitePay se temos API Key
      if (status !== 'pago' && INFINITEPAY_API_KEY) {
        try {
          const checkRes = await fetch('https://api.checkout.infinitepay.io/payment_check', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Api-Key': INFINITEPAY_API_KEY
            },
            body: JSON.stringify({ order_nsu: codigo })
          });
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            if (checkData.paid || checkData.status === 'paid' || checkData.event === 'paid') {
              status = 'pago';
              // Atualiza o Supabase imediatamente
              if (parcelas.length > 0) {
                parcelas[0].pago = checkData.paid_amount || parcelas[0].valor;
                parcelas[0].dataPag = todayISO();
                await fetch(`${SUPABASE_URL}/rest/v1/acampantes?codigo=eq.${encodeURIComponent(codigo)}`, {
                  method: 'PATCH',
                  headers: {
                    apikey: SUPABASE_SERVICE_ROLE_KEY,
                    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ parcelas })
                });
              }
            }
          }
        } catch (checkErr) {
          console.warn('Erro ao checar fallback InfinitePay:', checkErr.message);
        }
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          codigo: a.codigo,
          nome: a.nome,
          lote: a.lote,
          camiseta: a.camiseta,
          total,
          pago,
          status,
          confirmado: status === 'pago'
        })
      };
    } catch (err) {
      console.error('Erro ao consultar status:', err);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: err.message })
      };
    }
  }

  // Rota não encontrada
  return {
    statusCode: 404,
    headers: corsHeaders,
    body: JSON.stringify({ error: `Rota não encontrada: ${method} ${path}` })
  };
};
