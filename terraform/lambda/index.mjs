// Lambda Function para Checkout e Webhook da InfinitePay
// Acampamento IMERSOS 2027
// Instrumentada com logs detalhados para CloudWatch e diagnóstico

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key, Authorization',
  'Content-Type': 'application/json'
};

const DEFAULT_ANON_KEY = 'sb_publishable_stUBkyPTyqHtCla_seKJRw_k_LW2S_i';

function log(tag, message, data = null) {
  const timestamp = new Date().toISOString();
  if (data !== null) {
    const formatted = typeof data === 'object' ? JSON.stringify(data) : data;
    console.log(`[${timestamp}] [${tag}] ${message} => ${formatted}`);
  } else {
    console.log(`[${timestamp}] [${tag}] ${message}`);
  }
}

function logError(tag, message, err = null) {
  const timestamp = new Date().toISOString();
  if (err !== null) {
    const details = err && err.stack ? err.stack : (typeof err === 'object' ? JSON.stringify(err) : err);
    console.error(`[${timestamp}] [ERRO][${tag}] ${message} => ${details}`);
  } else {
    console.error(`[${timestamp}] [ERRO][${tag}] ${message}`);
  }
}

function parseBody(event) {
  if (!event.body) return {};
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf-8')
      : event.body;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (err) {
    logError('PARSER', 'Falha ao converter body para JSON', err.message);
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

function maskSecret(val) {
  if (!val) return '[NÃO DEFINIDO / VAZIO]';
  if (val.length <= 8) return '********';
  return val.slice(0, 5) + '...' + val.slice(-4) + ` (tamanho: ${val.length})`;
}

export const handler = async (event) => {
  const method = (event.requestContext?.http?.method || event.httpMethod || 'GET').toUpperCase();
  const rawPath = event.rawPath || event.requestContext?.http?.path || '/';
  const path = getPath(event);
  const requestId = event.requestContext?.requestId || 'req-' + Math.random().toString(36).slice(2, 8);

  log('REQ_INIT', `[${requestId}] Requisição recebida: ${method} ${rawPath} (path normalizado: ${path})`);

  // Resposta para pre-flight CORS
  if (method === 'OPTIONS') {
    log('CORS', `[${requestId}] Respondendo 200 para pre-flight OPTIONS`);
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

  // Log de diagnóstico de configuração do ambiente
  log('ENV_DIAG', `[${requestId}] Configurações ativas:`, {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: maskSecret(SUPABASE_SERVICE_ROLE_KEY),
    INFINITEPAY_API_KEY: maskSecret(INFINITEPAY_API_KEY),
    SITE_URL
  });

  const supabaseReadAuthKey = SUPABASE_SERVICE_ROLE_KEY || DEFAULT_ANON_KEY;

  // -------------------------------------------------------------------------
  // 1. GET /inscricoes (ou /api/inscricoes) -> Teste de acesso e lista de inscrições
  // -------------------------------------------------------------------------
  if (method === 'GET' && (path === '/inscricoes' || path === '/teste' || path === '/health')) {
    log('INSCRICOES', `[${requestId}] Iniciando consulta de teste na tabela 'acampantes'...`);
    try {
      const searchUrl = `${SUPABASE_URL}/rest/v1/acampantes?select=*`;
      log('INSCRICOES', `[${requestId}] Chamando Supabase: ${searchUrl} usando chave: ${maskSecret(supabaseReadAuthKey)}`);

      const startTime = Date.now();
      const searchRes = await fetch(searchUrl, {
        headers: {
          apikey: supabaseReadAuthKey,
          Authorization: `Bearer ${supabaseReadAuthKey}`
        }
      });
      const duration = Date.now() - startTime;

      log('INSCRICOES', `[${requestId}] Resposta do Supabase em ${duration}ms: HTTP ${searchRes.status} ${searchRes.statusText}`);

      if (!searchRes.ok) {
        const errText = await searchRes.text();
        logError('INSCRICOES', `[${requestId}] Falha na resposta do Supabase:`, { status: searchRes.status, body: errText });
        return {
          statusCode: searchRes.status,
          headers: corsHeaders,
          body: JSON.stringify({
            ok: false,
            banco_conectado: false,
            error: `Erro ao conectar com Supabase: ${searchRes.statusText}`,
            details: errText
          })
        };
      }

      const inscricoes = await searchRes.json();
      log('INSCRICOES', `[${requestId}] Sucesso! Total de inscrições encontradas: ${Array.isArray(inscricoes) ? inscricoes.length : 0}`);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          ok: true,
          banco_conectado: true,
          total_inscricoes: Array.isArray(inscricoes) ? inscricoes.length : 0,
          configuracao: {
            supabase_url: SUPABASE_URL,
            supabase_service_role_ativa: Boolean(SUPABASE_SERVICE_ROLE_KEY),
            infinitepay_configurada: Boolean(INFINITEPAY_API_KEY),
            site_url: SITE_URL
          },
          inscricoes
        }, null, 2)
      };
    } catch (err) {
      logError('INSCRICOES', `[${requestId}] Exceção não tratada ao buscar inscrições:`, err);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          ok: false,
          banco_conectado: false,
          error: err.message,
          stack: err.stack
        })
      };
    }
  }

  // -------------------------------------------------------------------------
  // 2. POST /checkout (ou /api/checkout) -> Cria link na API da InfinitePay
  // -------------------------------------------------------------------------
  if (method === 'POST' && (path === '/checkout' || path === '')) {
    log('CHECKOUT', `[${requestId}] Iniciando geração de link de checkout...`);
    try {
      const body = parseBody(event);
      log('CHECKOUT', `[${requestId}] Payload recebido no body:`, body);

      const { codigo, nome, valor, email, telefone } = body;

      if (!codigo || !valor) {
        logError('CHECKOUT', `[${requestId}] Validação falhou: codigo ou valor ausentes`, { codigo, valor });
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'codigo e valor (em centavos) são obrigatórios.' })
        };
      }

      if (!INFINITEPAY_API_KEY) {
        logError('CHECKOUT', `[${requestId}] Configuração ausente: INFINITEPAY_API_KEY está vazia`);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({
            error: 'INFINITEPAY_API_KEY não configurada no backend.',
            dica: 'Adicione a secret INFINITEPAY_API_KEY no GitHub Secrets ou nas variáveis da Lambda.'
          })
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

      log('CHECKOUT', `[${requestId}] Enviando para InfinitePay (https://api.checkout.infinitepay.io/links)...`, payload);

      const startTime = Date.now();
      const resp = await fetch('https://api.checkout.infinitepay.io/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': INFINITEPAY_API_KEY
        },
        body: JSON.stringify(payload)
      });
      const duration = Date.now() - startTime;

      const resData = await resp.json().catch(async () => ({ text: await resp.text() }));
      log('CHECKOUT', `[${requestId}] Resposta InfinitePay em ${duration}ms: HTTP ${resp.status}`, resData);

      if (!resp.ok) {
        logError('CHECKOUT', `[${requestId}] Erro retornado pela InfinitePay: HTTP ${resp.status}`, resData);
        return {
          statusCode: resp.status,
          headers: corsHeaders,
          body: JSON.stringify({
            error: 'Erro retornado pela InfinitePay',
            status: resp.status,
            details: resData
          })
        };
      }

      const checkoutUrl = resData.url || resData.link || (resData.data && (resData.data.url || resData.data.link));
      log('CHECKOUT', `[${requestId}] Link de checkout gerado com sucesso: ${checkoutUrl}`);

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
      logError('CHECKOUT', `[${requestId}] Exceção no fluxo de checkout:`, err);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: err.message, stack: err.stack })
      };
    }
  }

  // -------------------------------------------------------------------------
  // 3. POST /webhook (ou /api/webhook) -> Recebe notificação da InfinitePay
  // -------------------------------------------------------------------------
  if (method === 'POST' && path === '/webhook') {
    log('WEBHOOK', `[${requestId}] === WEBHOOK RECEBIDO ===`);
    try {
      const body = parseBody(event);
      log('WEBHOOK', `[${requestId}] Conteúdo completo do Webhook:`, body);

      const eventType = body.event || body.type;
      const orderNsu = body.order_nsu || body.orderId || body.reference;
      const amountPaid = body.paid_amount || body.amount;

      log('WEBHOOK', `[${requestId}] Dados extraídos: event=${eventType}, order_nsu=${orderNsu}, amountPaid=${amountPaid}`);

      // Só confirma a inscrição se for status de pagamento aprovado
      if (eventType !== 'paid' && eventType !== 'settled') {
        log('WEBHOOK', `[${requestId}] Evento ignorado (não é 'paid' ou 'settled'): ${eventType} para pedido: ${orderNsu}`);
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ ok: true, ignored: true, event: eventType })
        };
      }

      if (!orderNsu) {
        logError('WEBHOOK', `[${requestId}] Payload do webhook não contém order_nsu/código de pedido`);
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'order_nsu ausente no payload' })
        };
      }

      const writeKey = SUPABASE_SERVICE_ROLE_KEY || DEFAULT_ANON_KEY;
      log('WEBHOOK', `[${requestId}] Buscando acampante no Supabase pelo código ${orderNsu}...`);

      const searchUrl = `${SUPABASE_URL}/rest/v1/acampantes?codigo=eq.${encodeURIComponent(orderNsu)}&select=*`;
      const searchRes = await fetch(searchUrl, {
        headers: {
          apikey: writeKey,
          Authorization: `Bearer ${writeKey}`
        }
      });

      const acampantes = await searchRes.json();
      log('WEBHOOK', `[${requestId}] Resultado busca acampante: HTTP ${searchRes.status}`, acampantes);

      if (!Array.isArray(acampantes) || acampantes.length === 0) {
        logError('WEBHOOK', `[${requestId}] Nenhum acampante encontrado com código '${orderNsu}' no Supabase`);
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ ok: true, warning: 'Acampante não localizado no banco' })
        };
      }

      const acampante = acampantes[0];
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

      const updateUrl = `${SUPABASE_URL}/rest/v1/acampantes?codigo=eq.${encodeURIComponent(orderNsu)}`;
      const updateRes = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          apikey: writeKey,
          Authorization: `Bearer ${writeKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
        body: JSON.stringify({
          parcelas,
          obs: [acampante.obs, `Pago via InfinitePay (${body.capture_method || 'online'} - Ref: ${body.transaction_nsu || ''})`].filter(Boolean).join(' • ')
        })
      });

      const updateData = await updateRes.json().catch(async () => ({ text: await updateRes.text() }));
      log('WEBHOOK', `[${requestId}] Resposta da atualização no Supabase: HTTP ${updateRes.status}`, updateData);

      log('WEBHOOK_SUCCESS', `[${requestId}] Inscrição ${orderNsu} (${acampante.nome}) CONFIRMADA com valor de R$ ${(valorRecebido / 100).toFixed(2)}`);

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
      logError('WEBHOOK', `[${requestId}] Exceção não tratada ao processar webhook:`, err);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: err.message, stack: err.stack })
      };
    }
  }

  // -------------------------------------------------------------------------
  // 4. GET /status (ou /api/status?codigo=IMR-XXXX) -> Consulta status da inscrição
  // -------------------------------------------------------------------------
  if (method === 'GET' && path === '/status') {
    const params = event.queryStringParameters || {};
    const codigo = params.codigo;
    log('STATUS', `[${requestId}] Consulta de status solicitada para codigo: '${codigo}'`);

    try {
      if (!codigo) {
        logError('STATUS', `[${requestId}] Parâmetro 'codigo' não informado na query string`);
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Parâmetro 'codigo' é obrigatório na URL (ex: /api/status?codigo=IMR-XXXX)" })
        };
      }

      const searchUrl = `${SUPABASE_URL}/rest/v1/acampantes?codigo=eq.${encodeURIComponent(codigo)}&select=*`;
      log('STATUS', `[${requestId}] Consultando Supabase: ${searchUrl}`);

      const searchRes = await fetch(searchUrl, {
        headers: {
          apikey: supabaseReadAuthKey,
          Authorization: `Bearer ${supabaseReadAuthKey}`
        }
      });

      const acampantes = await searchRes.json();
      log('STATUS', `[${requestId}] Resposta Supabase: HTTP ${searchRes.status}`, acampantes);

      if (!Array.isArray(acampantes) || acampantes.length === 0) {
        logError('STATUS', `[${requestId}] Inscrição com código '${codigo}' não foi encontrada no banco`);
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

      log('STATUS', `[${requestId}] Inscrição encontrada: Nome='${a.nome}', Total=${total}, Pago=${pago}, Status='${status}'`);

      // Fallback: se ainda estiver pendente, pode checar na InfinitePay se temos API Key
      if (status !== 'pago' && INFINITEPAY_API_KEY) {
        log('STATUS', `[${requestId}] Status pendente: checando fallback direto na InfinitePay (/payment_check)...`);
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
            log('STATUS', `[${requestId}] Resposta payment_check InfinitePay:`, checkData);
            if (checkData.paid || checkData.status === 'paid' || checkData.event === 'paid') {
              status = 'pago';
              log('STATUS', `[${requestId}] Pagamento detectado na InfinitePay! Atualizando banco...`);
              if (parcelas.length > 0) {
                parcelas[0].pago = checkData.paid_amount || parcelas[0].valor;
                parcelas[0].dataPag = todayISO();
                await fetch(`${SUPABASE_URL}/rest/v1/acampantes?codigo=eq.${encodeURIComponent(codigo)}`, {
                  method: 'PATCH',
                  headers: {
                    apikey: SUPABASE_SERVICE_ROLE_KEY || DEFAULT_ANON_KEY,
                    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY || DEFAULT_ANON_KEY}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ parcelas })
                });
              }
            }
          } else {
            logError('STATUS', `[${requestId}] Resposta payment_check HTTP ${checkRes.status}:`, await checkRes.text());
          }
        } catch (checkErr) {
          logError('STATUS', `[${requestId}] Exceção no fallback payment_check:`, checkErr.message);
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
      logError('STATUS', `[${requestId}] Exceção não tratada ao consultar status:`, err);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: err.message, stack: err.stack })
      };
    }
  }

  // Rota não encontrada
  logError('NOT_FOUND', `[${requestId}] Rota não encontrada: ${method} ${path}`);
  return {
    statusCode: 404,
    headers: corsHeaders,
    body: JSON.stringify({
      error: `Rota não encontrada: ${method} ${path}`,
      rotas_disponiveis: [
        'GET /api/inscricoes',
        'POST /api/checkout',
        'POST /api/webhook',
        'GET /api/status?codigo=IMR-XXXX'
      ]
    })
  };
};
