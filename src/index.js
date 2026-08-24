/**
 * ============================================================================
 * CLOUDFLARE EMAIL WORKER - PASSERELLE INTELLIGENTE BALDEBRAISE (V3 INFALLIBLE)
 * ============================================================================
 * Gère le relai des réponses Gmail vers les clients avec :
 * 1. Détection élargie des adresses d'expédition (ciebaldebraise & axe.aube)
 * 2. Nettoyage complet des citations brutes
 * 3. Condensé élégant de la demande de devis initiale
 * 4. Double moteur d'expédition (MailChannels + Resend API si configurée)
 */

const OWNER_EMAILS = [
  'ciebaldebraise@gmail.com',
  'cie.baldebraise@gmail.com',
  'axe.aube@gmail.com',
  'axeaube@gmail.com'
];

const OFFICIAL_EMAIL = 'compagnie@baldebraise.com';
const BRAND_NAME = 'Compagnie BalDeBraise';
const LOGO_URL = 'https://baldebraise.com/assets/media/logos/logo_v2_clean.png';
const SITE_URL = 'https://baldebraise.com';
const PHONE_NUMBER = '+33 7 86 62 75 92';

function encodeClientTag(clientEmail) {
  return clientEmail.replace(/@/g, '=');
}

function decodeClientTag(tag) {
  return tag.replace(/=/g, '@');
}

// Extraction du message propre et du condensé de la demande initiale
function parseGmailReply(rawText) {
  const splitRegex = /(?:On\s+[\w\s,:]+\s+at\s+[\d:]+\s*(?:AM|PM)?[\s\S]*?wrote:|Le\s+[\w\s,.:]+a\s+écrit\s*:|---------- Forwarded message ---------|------------- Message transféré -------------)/i;
  
  let userReply = rawText;
  let quotedText = '';

  const match = rawText.match(splitRegex);
  if (match && match.index !== undefined) {
    userReply = rawText.substring(0, match.index).trim();
    quotedText = rawText.substring(match.index).trim();
  }

  let quoteInfo = null;
  if (quotedText.includes('DEMANDE DE DEVIS') || quotedText.includes('DEVIS BALDEBRAISE')) {
    let requestDate = '';
    const dateMatch = quotedText.match(/(?:On\s+([\w\s,:]+?)\s+wrote:|Le\s+([\w\s,.:]+?)\s+a\s+écrit)/i);
    if (dateMatch) {
      requestDate = (dateMatch[1] || dateMatch[2] || '').trim();
    }

    const eventTypeMatch = quotedText.match(/(?:DEMANDE DE DEVIS\s*\n\s*([^\n]+)|Formule\s*:\s*([^\n]+))/i);
    const clientMatch = quotedText.match(/CLIENT\s*([^\n]+)/i);
    const phoneMatch = quotedText.match(/TÉLÉPHONE\s*([^\n]+)/i);
    const dateFieldMatch = quotedText.match(/DATE\s*([^\n]+)/i);
    const locationMatch = quotedText.match(/LIEU\s*([^\n]+)/i);
    const msgMatch = quotedText.match(/MESSAGE\s*([\s\S]*?)(?:BalDeBraise|Reçu depuis|$)/i);

    quoteInfo = {
      requestDate: requestDate,
      eventType: eventTypeMatch ? (eventTypeMatch[1] || eventTypeMatch[2] || '').trim() : '',
      clientName: clientMatch ? clientMatch[1].trim() : '',
      phone: phoneMatch ? phoneMatch[1].trim() : '',
      eventDate: dateFieldMatch ? dateFieldMatch[1].trim() : '',
      location: locationMatch ? locationMatch[1].trim() : '',
      initialMessage: msgMatch ? msgMatch[1].trim() : ''
    };
  }

  return { userReply, quoteInfo };
}

// Construction du template VIP BalDeBraise avec condensé de la demande
function buildVipResponseTemplate(userReply, quoteInfo, subject) {
  const cleanReplyHtml = userReply
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  let quoteSummaryHtml = '';
  if (quoteInfo) {
    quoteSummaryHtml = `
      <div style="margin-top: 28px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 85, 0, 0.25); border-left: 4px solid #FF5500; border-radius: 10px; padding: 18px 20px;">
        <div style="color: #FFAA00; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
          📋 Rappel de votre demande de devis ${quoteInfo.requestDate ? '(' + quoteInfo.requestDate + ')' : ''}
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13.5px; color: #94A3B8;">
          ${quoteInfo.eventType ? `<tr><td style="padding: 4px 0; width: 120px; color: #64748B;">Événement :</td><td style="color: #F0F4FC; font-weight: 600;">${quoteInfo.eventType}</td></tr>` : ''}
          ${quoteInfo.location ? `<tr><td style="padding: 4px 0; color: #64748B;">Lieu / Dép. :</td><td style="color: #F0F4FC; font-weight: 600;">${quoteInfo.location}</td></tr>` : ''}
          ${quoteInfo.eventDate && quoteInfo.eventDate !== 'Non spécifiée' ? `<tr><td style="padding: 4px 0; color: #64748B;">Date prévue :</td><td style="color: #F0F4FC; font-weight: 600;">${quoteInfo.eventDate}</td></tr>` : ''}
          ${quoteInfo.initialMessage && quoteInfo.initialMessage !== 'Aucune précision.' ? `<tr><td style="padding: 6px 0 0 0; color: #64748B; vertical-align: top;">Précisions :</td><td style="padding: 6px 0 0 0; color: #CBD5E1; font-style: italic;">« ${quoteInfo.initialMessage} »</td></tr>` : ''}
        </table>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject || 'Compagnie BalDeBraise'}</title>
</head>
<body style="font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif; background-color: #07090E; color: #F0F4FC; margin: 0; padding: 24px 12px;">
  <div style="max-width: 620px; margin: 0 auto; background: #0F131C; border: 1px solid rgba(255, 85, 0, 0.35); border-radius: 16px; overflow: hidden; box-shadow: 0 12px 35px rgba(0,0,0,0.6);">
    
    <!-- En-tête officiel BalDeBraise -->
    <div style="background: linear-gradient(135deg, #121724 0%, #07090E 100%); padding: 26px 20px; text-align: center; border-bottom: 2px solid #FF5500;">
      <a href="${SITE_URL}" target="_blank" style="text-decoration: none;">
        <img src="${LOGO_URL}" alt="BalDeBraise Logo" style="max-height: 52px; height: 52px; width: auto; display: inline-block;">
      </a>
    </div>

    <!-- Corps : Message de la compagnie -->
    <div style="padding: 32px 28px; font-size: 15.5px; line-height: 1.75; color: #E2E8F0;">
      <div style="color: #FFFFFF;">
        ${cleanReplyHtml}
      </div>

      <!-- Condensé de la demande -->
      ${quoteSummaryHtml}
    </div>

    <!-- Pied de page officiel VIP -->
    <div style="background: #080A10; padding: 24px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.08); font-size: 13px; color: #94A3B8;">
      <div style="color: #FFAA00; font-weight: 700; font-size: 14px; margin-bottom: 4px;">Compagnie BalDeBraise</div>
      <p style="margin: 3px 0 10px 0; font-size: 12px; color: #64748B;">Spectacles de Feu d'Exception, Pyrotechnie &amp; Créations Pixel LED HD</p>
      
      <div style="margin: 12px 0;">
        <a href="tel:${PHONE_NUMBER.replace(/\s+/g, '')}" style="color: #00F0FF; text-decoration: none; font-weight: 600; margin: 0 8px;">📞 ${PHONE_NUMBER}</a> •
        <a href="${SITE_URL}" target="_blank" style="color: #00F0FF; text-decoration: none; font-weight: 600; margin: 0 8px;">🌐 baldebraise.com</a>
      </div>

      <div style="display: inline-block; background: rgba(255,85,0,0.12); color: #FFAA00; border: 1px solid rgba(255,85,0,0.35); padding: 4px 12px; border-radius: 12px; font-size: 11px; margin-top: 8px;">
        🛡️ Assurance RC Pro Spectacle Vivant &amp; Normes Artifices F4/T2
      </div>
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

    console.log(`📨 [Email Worker] De [${sender}] Vers [${recipient}] | Objet : ${rawSubject}`);

    // =========================================================================
    // CAS 1 : RÉPONSE VERS LE RELAIS (relais+client=domaine@baldebraise.com)
    // =========================================================================
    const isRelayReply = recipient.includes('relais+') || recipient.includes('reply+');
    const isAuthorizedSender = OWNER_EMAILS.some(owner => sender.includes(owner.toLowerCase())) || isRelayReply;

    if (isRelayReply && isAuthorizedSender) {
      console.log('⚡ [Relais Activé] Détection d\'une réponse Gmail -> Redirection vers le client...');

      // Extraction de l'email client depuis le destinataire relais+client=domaine.com@...
      const match = recipient.match(/(?:relais|reply)\+([^@>]+)@/i);
      if (!match || !match[1]) {
        console.error('❌ Impossible de décoder l\'email client depuis :', recipient);
        return;
      }

      const clientEmail = decodeClientTag(match[1]);
      console.log(`🎯 Email client cible : ${clientEmail}`);

      const rawMime = await readRawText(message.raw);
      
      let bodyText = rawMime;
      if (rawMime.includes('\r\n\r\n')) {
        bodyText = rawMime.split('\r\n\r\n').slice(1).join('\r\n\r\n');
      }

      const { userReply, quoteInfo } = parseGmailReply(bodyText);
      const cleanSubject = rawSubject.startsWith('Re:') ? rawSubject : `Re: ${rawSubject}`;
      const htmlContent = buildVipResponseTemplate(userReply, quoteInfo, cleanSubject);

      // Si une clé Resend API est configurée dans l'environnement Cloudflare
      if (env && env.RESEND_API_KEY) {
        console.log('🚀 Envoi via Resend API...');
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: `${BRAND_NAME} <${OFFICIAL_EMAIL}>`,
            to: [clientEmail],
            reply_to: `relais+${encodeClientTag(clientEmail)}@baldebraise.com`,
            subject: cleanSubject,
            html: htmlContent,
            text: userReply
          })
        });
        console.log(`📤 Statut Resend : HTTP ${resendRes.status}`);
        return;
      }

      // Par défaut : Expédition via MailChannels API
      console.log('🚀 Envoi via MailChannels API...');
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
            value: userReply
          }
        ]
      };

      const sendRes = await fetch('https://api.mailchannels.net/tx/v1/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mailchannelsPayload)
      });

      const resBody = await sendRes.text();
      console.log(`📤 Statut MailChannels HTTP ${sendRes.status} : ${resBody.substring(0, 100)}`);
      return;
    }

    // =========================================================================
    // CAS 2 : RÉCEPTION D'UN NOUVEAU MESSAGE D'UN CLIENT
    // =========================================================================
    console.log('📬 Réception d\'un nouveau message client -> Transfert enrichi vers Gmail');

    const clientTag = encodeClientTag(sender);
    const relayReplyTo = `relais+${clientTag}@baldebraise.com`;

    await message.forward(OWNER_EMAILS[0], new Headers({
      'Reply-To': relayReplyTo,
      'X-BalDeBraise-Client': sender
    }));

    console.log(`✅ Message transféré à ${OWNER_EMAILS[0]} avec Reply-To: ${relayReplyTo}`);
  }
};
