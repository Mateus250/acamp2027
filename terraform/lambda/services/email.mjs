// Serviço de Envio de E-mails com QR Code e Notificação de Check-in
import { log, logError } from '../utils/logger.mjs';

/**
 * Monta o HTML do e-mail de confirmação com QR Code e aviso de menor de idade
 */
export function buildConfirmationEmailHtml({ nome, codigo, idade, menor, responsavel, camiseta, lote }) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(codigo)}`;

  const blocoMenor = menor ? `
    <div style="background-color:#FDF2E9;border-left:5px solid #E06D53;padding:16px 18px;border-radius:8px;margin:22px 0;">
      <h3 style="margin:0 0 8px;color:#C0442D;font-size:16px;font-family:sans-serif;">
        ⚠️ AVISO OBRIGATÓRIO PARA MENORES DE 18 ANOS
      </h3>
      <p style="margin:0;font-size:14px;color:#2D3748;line-height:1.55;font-family:sans-serif;">
        Identificamos que você terá menos de 18 anos no acampamento${idade ? ` (<b>${idade} anos</b>)` : ''}.
        <b>É OBRIGATÓRIO</b> apresentar no momento do embarque/check-in o <b>Termo de Autorização dos Pais/Responsáveis preenchido e assinado</b>${responsavel ? ` por <b>${responsavel}</b>` : ''}, acompanhado de cópia do documento de identificação. Sem este documento, não será permitido o embarque nem o check-in no local.
      </p>
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Confirmação de Inscrição · Imersos 2027</title>
</head>
<body style="margin:0;padding:24px 12px;background-color:#EAF2F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0F2A33;">
  <div style="max-width:580px;margin:0 auto;background-color:#FFFFFF;border-radius:18px;overflow:hidden;border:1px solid #D0DFDB;box-shadow:0 4px 18px rgba(0,0,0,0.06);">
    <!-- Cabeçalho -->
    <div style="background-color:#16707C;color:#FFFFFF;padding:28px 24px;text-align:center;">
      <h1 style="margin:0;font-size:32px;letter-spacing:-0.02em;font-weight:800;">IMERSOS</h1>
      <p style="margin:6px 0 0;font-size:15px;opacity:0.9;">Acampamento de Carnaval 2027 · IPI Itajaí</p>
    </div>

    <!-- Conteúdo Principal -->
    <div style="padding:28px 24px;">
      <h2 style="margin:0 0 12px;color:#0F2A33;font-size:22px;">Inscrição Confirmada! 🎉</h2>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.5;color:#566C72;">
        Olá, <b>${nome}</b>! Seu pagamento foi confirmado com sucesso e a sua vaga para o Acampamento Imersos 2027 está garantida!
      </p>

      <!-- Cartão QR Code de Check-in -->
      <div style="background-color:#F7FAF9;border:2px dashed #16707C;border-radius:14px;padding:22px;text-align:center;margin:22px 0;">
        <span style="display:inline-block;background-color:#CCE5E4;color:#0E5762;font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px;text-transform:uppercase;letter-spacing:0.04em;">
          Seu Ingresso de Check-in
        </span>
        <div style="margin:16px auto;width:200px;height:200px;background:#FFFFFF;padding:8px;border-radius:10px;border:1px solid #D0DFDB;">
          <img src="${qrUrl}" alt="QR Code de Check-in" width="200" height="200" style="display:block;width:100%;height:100%;">
        </div>
        <div style="font-size:24px;font-weight:800;font-family:monospace;letter-spacing:0.08em;color:#16707C;margin-top:8px;">
          ${codigo}
        </div>
        <p style="margin:8px 0 0;font-size:13px;color:#566C72;">
          Apresente este QR Code direto pelo celular ou impresso na recepção do acampamento para liberar sua entrada e retirar seu kit.
        </p>
      </div>

      ${blocoMenor}

      <!-- Resumo da Inscrição -->
      <div style="background-color:#F7FAF9;border:1px solid #D0DFDB;border-radius:12px;padding:16px;margin:20px 0;font-size:14px;">
        <h4 style="margin:0 0 10px;font-size:13px;text-transform:uppercase;color:#566C72;letter-spacing:0.03em;">Resumo da Inscrição</h4>
        <div style="margin-bottom:6px;"><b>Participante:</b> ${nome}</div>
        <div style="margin-bottom:6px;"><b>Código da inscrição:</b> ${codigo}</div>
        ${camiseta ? `<div style="margin-bottom:6px;"><b>Camiseta:</b> ${camiseta}</div>` : ''}
        ${lote ? `<div style="margin-bottom:6px;"><b>Lote:</b> ${lote}</div>` : ''}
        <div><b>Status:</b> Confirmado / Quitado</div>
      </div>

      <!-- Informações Práticas -->
      <div style="font-size:14px;line-height:1.55;color:#566C72;margin-top:20px;">
        <h4 style="margin:0 0 8px;font-size:15px;color:#0F2A33;">Informações Importantes:</h4>
        <ul style="margin:0 0 16px;padding-left:20px;">
          <li><b>Quando:</b> 5 a 9 de fevereiro de 2027 (Carnaval)</li>
          <li><b>Onde:</b> Espaço SET – Indaiatuba</li>
          <li><b>O que levar:</b> Roupas leves e de frio, toalha, itens de higiene pessoal, Bíblia, caderno, caneta, tênis e protetor solar.</li>
        </ul>
      </div>

      <div style="border-top:1px solid #D0DFDB;padding-top:18px;margin-top:22px;text-align:center;font-size:13px;color:#566C72;">
        Dúvidas? Entre em contato com a organização pelo WhatsApp ou pelo site <a href="https://acampamentoipi.com.br" style="color:#16707C;font-weight:700;text-decoration:none;">acampamentoipi.com.br</a>.
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Envia o e-mail de confirmação para o acampante
 */
export async function sendConfirmationEmail({ acampante, env, requestId = '' }) {
  if (!acampante || !acampante.email) {
    log('EMAIL_SKIP', `[${requestId}] Acampante sem e-mail cadastrado, pulando envio de e-mail.`);
    return { ok: false, reason: 'no_email' };
  }

  // Verifica se o participante é menor de idade
  const idadeNum = Number(acampante.idade);
  const menor = (idadeNum && idadeNum < 18) ||
    Boolean(acampante.responsavel && acampante.responsavel.trim().length > 1) ||
    Boolean(acampante.obs && /Resp\d/i.test(acampante.obs));

  const subject = `Inscrição Confirmada · QR Code de Check-in (${acampante.codigo}) - Imersos 2027`;
  const html = buildConfirmationEmailHtml({
    nome: acampante.nome,
    codigo: acampante.codigo,
    idade: idadeNum || null,
    menor,
    responsavel: acampante.responsavel,
    camiseta: acampante.camiseta,
    lote: acampante.lote
  });

  log('EMAIL_SENDING', `[${requestId}] Enviando e-mail de confirmação para ${acampante.email} (${acampante.nome}, menor=${menor})`);

  // 1. Envio via Resend API (se configurado)
  if (env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.RESEND_API_KEY}`
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM || 'Acampamento Imersos <contato@acampamentoipi.com.br>',
          to: [acampante.email],
          subject,
          html
        })
      });
      const data = await res.json();
      if (res.ok) {
        log('EMAIL_SENT_RESEND', `[${requestId}] E-mail enviado com sucesso via Resend: ID=${data.id}`);
        return { ok: true, provider: 'resend', id: data.id };
      }
      logError('EMAIL_RESEND_ERROR', `[${requestId}] Erro na resposta do Resend:`, data);
    } catch (errResend) {
      logError('EMAIL_RESEND_FAIL', `[${requestId}] Exceção ao chamar Resend:`, errResend);
    }
  }

  // 2. Envio via AWS SES (se disponível)
  try {
    const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses');
    const ses = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });
    const cmd = new SendEmailCommand({
      Destination: { ToAddresses: [acampante.email] },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: { Html: { Data: html, Charset: 'UTF-8' } }
      },
      Source: env.EMAIL_FROM || 'contato@acampamentoipi.com.br'
    });
    const sesRes = await ses.send(cmd);
    log('EMAIL_SENT_SES', `[${requestId}] E-mail enviado com sucesso via AWS SES: MessageId=${sesRes.MessageId}`);
    return { ok: true, provider: 'ses', messageId: sesRes.MessageId };
  } catch (errSes) {
    log('EMAIL_SES_INFO', `[${requestId}] AWS SES não executado ou não configurado: ${errSes.message}`);
  }

  // 3. Fallback informativo
  log('EMAIL_PREVIEW_GENERATED', `[${requestId}] E-mail preparado com sucesso para ${acampante.email}. Assunto: "${subject}" (QR Code gerado para ${acampante.codigo})`);
  return { ok: true, provider: 'preview', htmlGenerated: true };
}
