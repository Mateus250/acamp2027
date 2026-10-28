// Rotas /inscricoes (GET: teste de acesso / health; POST: inserção segura de nova inscrição)
import { json } from '../utils/response.mjs';
import { log, logError } from '../utils/logger.mjs';
import { fetchInscricoes, insertAcampante, findAcampanteByDocumento } from '../services/supabase.mjs';

export async function handleInscricoes(env, requestId) {
  log('INSCRICOES', `[${requestId}] Iniciando consulta de teste na tabela 'acampantes'...`);
  try {
    const inscricoes = await fetchInscricoes({
      supabaseUrl: env.SUPABASE_URL,
      authKey: env.supabaseReadAuthKey,
      requestId
    });

    log('INSCRICOES', `[${requestId}] Sucesso! Total de inscrições: ${Array.isArray(inscricoes) ? inscricoes.length : 0}`);

    return json(200, {
      ok: true,
      banco_conectado: true,
      total_inscricoes: Array.isArray(inscricoes) ? inscricoes.length : 0,
      configuracao: {
        supabase_url: env.SUPABASE_URL,
        supabase_service_role_ativa: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
        infinitepay_configurada: Boolean(env.INFINITEPAY_API_KEY),
        site_url: env.SITE_URL
      },
      inscricoes
    });
  } catch (err) {
    logError('INSCRICOES', `[${requestId}] Erro ao buscar inscrições:`, err);
    return json(500, {
      ok: false,
      banco_conectado: false,
      error: err.message,
      stack: err.stack
    });
  }
}

export async function handleCreateInscricao(body, env, requestId) {
  log('CREATE_INSCRICAO', `[${requestId}] Recebendo nova inscrição via API...`, {
    codigo: body?.codigo,
    nome: body?.nome,
    email: body?.email
  });

  const { codigo, nome, parcelas } = body || {};
  if (!codigo || !nome || !parcelas) {
    return json(400, {
      ok: false,
      error: 'Campos obrigatórios ausentes: codigo, nome e parcelas são requeridos.'
    });
  }

  // Extrai CPF se presente em obs ou documento para conferência de duplicidade
  const obs = body.obs || '';
  const cpfMatch = obs.match(/CPF:\s*(\d{11})/i) || obs.match(/CPF:\s*([\d\.\-]{14})/i);
  const cpfDigits = body.documento || (cpfMatch ? cpfMatch[1].replace(/\D/g, '') : '');

  if (cpfDigits && cpfDigits.length === 11) {
    try {
      const exist = await findAcampanteByDocumento({
        supabaseUrl: env.SUPABASE_URL,
        authKey: env.supabaseReadAuthKey,
        documento: cpfDigits,
        requestId
      });

      if (exist) {
        log('CREATE_INSCRICAO', `[${requestId}] Tentativa de inscrição com CPF já cadastrado (${exist.codigo})`);
        return json(409, {
          ok: false,
          error: `Já existe uma inscrição com este CPF (${exist.nome} - Código: ${exist.codigo}).`,
          jaInscrito: {
            nome: exist.nome,
            codigo: exist.codigo
          }
        });
      }
    } catch (eDup) {
      logError('CREATE_INSCRICAO', `[${requestId}] Aviso ao conferir duplicidade no banco:`, eDup.message);
    }
  }

  // Prepara linha para inserção sanitizada
  const row = {
    codigo: String(body.codigo).trim().toUpperCase(),
    nome: String(body.nome).trim(),
    telefone: body.telefone || null,
    email: body.email || null,
    nascimento: body.nascimento || null,
    idade: body.idade != null && !isNaN(body.idade) ? Number(body.idade) : null,
    camiseta: body.camiseta || null,
    responsavel: body.responsavel || null,
    responsavel_tel: body.responsavel_tel || null,
    obs: body.obs || null,
    lote: body.lote || null,
    opcao_id: body.opcao_id || null,
    opcao_nome: body.opcao_nome || null,
    parcelas: Array.isArray(body.parcelas) ? body.parcelas : [],
    origem: body.origem || 'site'
  };

  try {
    const res = await insertAcampante({
      supabaseUrl: env.SUPABASE_URL,
      authKey: env.supabaseWriteAuthKey,
      acampanteData: row,
      requestId
    });

    if (!res.ok) {
      return json(res.status || 500, {
        ok: false,
        error: 'Não foi possível registrar a inscrição no banco de dados.',
        details: res.error
      });
    }

    log('CREATE_INSCRICAO_SUCCESS', `[${requestId}] Inscrição ${row.codigo} (${row.nome}) inserida com sucesso!`);
    return json(201, {
      ok: true,
      codigo: row.codigo,
      id: res.data?.id || null,
      message: 'Inscrição registrada com sucesso!'
    });
  } catch (err) {
    logError('CREATE_INSCRICAO_ERR', `[${requestId}] Exceção ao inserir inscrição:`, err);
    return json(500, {
      ok: false,
      error: err.message
    });
  }
}
