/**
 * ============================================================================
 * CLOUDFLARE EMAIL WORKER - PASSERELLE INTELLIGENTE BALDEBRAISE
 * ============================================================================
 * Permet de répondre aux clients directement depuis Gmail (ciebaldebraise@gmail.com)
 * avec l'expéditeur officiel compagnie@baldebraise.com et une mise en page VIP.
 */

const OWNER_EMAILS = ['ciebaldebraise@gmail.com', 'cie.baldebraise@gmail.com'];
const OFFICIAL_EMAIL = 'compagnie@baldebraise.com';
const BRAND_NAME = 'Compagnie BalDeBraise';
const LOGO_URL = 'https://baldebraise.com/assets/media/logos/logo_v2_clean.png';
const SITE_URL = 'https://baldebraise.com';
const PHONE_NUMBER = '+33 7 86 62 75 92';

// Encodage / Décodage de l'email client dans l'alias de réponse
function encodeClientTag(clientEmail) {
  return clientEmail.replace('@', '=');
}

function decodeClientTag(tag) {
  return tag.replace('=', '@');
}

// Template HTML VIP BalDeBraise pour les réponses
function buildVipResponseTemplate(bodyText, subject) {
  const formattedText = bodyText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject || 'Compagnie BalDeBraise'}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #07090E; color: #F0F4FC; margin: 0; padding: 24px 12px; }
    .email-container { max-width: 620px; margin: 0 auto; background: #0F131C; border: 1px solid rgba(255, 85, 0, 0.35); border-radius: 14px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.6); }
    .header { background: linear-gradient(135deg, #121724 0%, #07090E 100%); padding: 24px; text-align: center; border-bottom: 2px solid #FF5500; }
    .logo { max-height: 55px; height: 55px; width: auto; }
    .content { padding: 32px 28px; font-size: 15px; line-height: 1.7; color: #E2E8F0; }
    .footer { background: #080A10; padding: 24px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.08); font-size: 13px; color: #94A3B8; }
    .footer-title { color: #FFAA00; font-weight: 700; font-size: 14px; margin-bottom: 6px; }
    .footer-links a { color: #00F0FF; text-decoration: none; margin: 0 8px; }
    .badge-safety { display: inline-block; background: rgba(255,85,0,0.15); color: #FFAA00; border: 1px solid rgba(255,85,0,0.4); padding: 3px 10px; border-radius: 12px; font-size: 11px; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <a href="${SITE_URL}" target="_blank">
        <img src="${LOGO_URL}" alt="BalDeBraise Logo" class="logo">
      </a>
    </div>
    <div class="content">
      ${formattedText}
    </div>
    <div class="footer">
      <div class="footer-title">Compagnie BalDeBraise</div>
      <p style="margin: 4px 0;">Spectacles de Feu d'Exception, Pyrotechnie &amp; Créations Pixel LED HD</p>
      <div class="footer-links" style="margin: 12px 0;">
        <a href="tel:${PHONE_NUMBER.replace(/\s+/g, '')}">📞 ${PHONE_NUMBER}</a> •
        <a href="${SITE_URL}" target="_blank">🌐 baldebraise.com</a>
      </div>
      <div class="badge-safety">🛡️ Assurance RC Pro Spectacle Vivant &amp; Normes Artifices F4/T2</div>
    </div>
  </div>
</body>
</html>`;
}

// Extraction du texte brut propre d'un stream MIME
async function readRawText(stream) {
  const reader = stream.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  return new TextDecoder('utf-8').decode(result);
}

export default {
  async email(message, env, ctx) {
    const sender = (message.from || '').toLowerCase().trim();
    const recipient = (message.to || '').toLowerCase().trim();
    const rawSubject = message.headers.get('subject') || 'Message BalDeBraise';

    console.log(`📨 Email reçu : De [${sender}] Vers [${recipient}] | Objet : ${rawSubject}`);

    // =========================================================================
    // CAS 1 : VOUS RÉPONDEZ DEPUIS GMAIL (ciebaldebraise@gmail.com)
    // =========================================================================
    const isOwner = OWNER_EMAILS.some(owner => sender.includes(owner));
    const isRelayReply = recipient.includes('relais+') || recipient.includes('reply+');

    if (isOwner && isRelayReply) {
      console.log('⚡ Détection d\'une réponse du gérant depuis Gmail -> Renvoi vers le client');

      const match = recipient.match(/(?:relais|reply)\+([^@]+)@/);
      if (!match || !match[1]) {
        console.error('❌ Destinataire client invalide :', recipient);
        return;
      }

      const clientEmail = decodeClientTag(match[1]);
      console.log(`🎯 Email client décodé : ${clientEmail}`);

      const rawMime = await readRawText(message.raw);
      
      let cleanBody = rawMime;
      if (rawMime.includes('\r\n\r\n')) {
        cleanBody = rawMime.split('\r\n\r\n').slice(1).join('\r\n\r\n');
      }
      
      if (cleanBody.includes('Le ') && cleanBody.includes('a écrit :')) {
        cleanBody = cleanBody.split(/Le .* a écrit :/)[0].trim();
      } else if (cleanBody.includes('On ') && cleanBody.includes('wrote:')) {
        cleanBody = cleanBody.split(/On .* wrote:/)[0].trim();
      }

      const cleanSubject = rawSubject.startsWith('Re:') ? rawSubject : `Re: ${rawSubject}`;
      const htmlContent = buildVipResponseTemplate(cleanBody, cleanSubject);

      const mailchannelsPayload = {
        personalizations: [
          {
            to: [{ email: clientEmail }]
          }
        ],
        from: {
          email: OFFICIAL_EMAIL,
          name: BRAND_NAME
        },
        reply_to: {
          email: `relais+${encodeClientTag(clientEmail)}@baldebraise.com`,
          name: BRAND_NAME
        },
        subject: cleanSubject,
        content: [
          {
            type: 'text/html',
            value: htmlContent
          },
          {
            type: 'text/plain',
            value: cleanBody
          }
        ]
      };

      const sendRes = await fetch('https://api.mailchannels.net/tx/v1/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mailchannelsPayload)
      });

      console.log(`📤 Statut d'envoi vers ${clientEmail} : HTTP ${sendRes.status}`);
      return;
    }

    // =========================================================================
    // CAS 2 : UN CLIENT ÉCRIT À COMPAGNIE@BALDEBRAISE.COM
    // =========================================================================
    console.log('📬 Réception d\'un message client -> Transfert enrichi vers Gmail');

    const clientTag = encodeClientTag(sender);
    const relayReplyTo = `relais+${clientTag}@baldebraise.com`;

    await message.forward(OWNER_EMAILS[0], new Headers({
      'Reply-To': relayReplyTo,
      'X-BalDeBraise-Client': sender
    }));

    console.log(`✅ Message transféré à ${OWNER_EMAILS[0]} avec Reply-To: ${relayReplyTo}`);
  }
};
