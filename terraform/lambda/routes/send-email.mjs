import { json } from '../utils/response.mjs';
import { log, logError } from '../utils/logger.mjs';
import { findAcampanteByCodigo } from '../services/supabase.mjs';
import { sendConfirmationEmail } from '../services/email.mjs';

export async function handleSendEmail(body, env, requestId) {
  const { codigo } = body || {};
  if (!codigo) {
    return json(400, { error: 'Código da inscrição é obrigatório' });
  }

  log('ROUTE_SEND_EMAIL', `[${requestId}] Solicitação de envio de e-mail para código '${codigo}'`);

  try {
    const acampante = await findAcampanteByCodigo({
      supabaseUrl: env.SUPABASE_URL,
      authKey: env.supabaseWriteAuthKey,
      codigo,
      requestId
    });

    if (!acampante) {
      return json(404, { error: `Inscrição não encontrada com o código '${codigo}'` });
    }

    if (!acampante.email) {
      return json(400, { error: 'Este participante não possui e-mail cadastrado.' });
    }

    const result = await sendConfirmationEmail({ acampante, env, requestId });
    return json(200, {
      ok: true,
      message: `E-mail com QR Code enviado para ${acampante.email}`,
      result
    });
  } catch (err) {
    logError('ROUTE_SEND_EMAIL_ERR', `[${requestId}] Erro ao enviar e-mail:`, err);
    return json(500, { error: err.message });
  }
}
