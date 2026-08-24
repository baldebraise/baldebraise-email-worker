/**
 * ============================================================================
 * CLOUDFLARE EMAIL WORKER - PASSERELLE SÉCURISÉE & CONDENSÉE BALDEBRAISE
 * ============================================================================
 * 1. Sécurité : Vérifie que seule l'adresse ciebaldebraise@gmail.com relaye.
 * 2. Parsing propre : Extrait le message sans aucune citation brute.
 * 3. Condensé VIP : Intègre le récapitulatif chic de la demande initiale.
 * 4. Expédition : Envoi officiel depuis compagnie@baldebraise.com.
 */

const OWNER_EMAILS = [
  'ciebaldebraise@gmail.com',
  'cie.baldebraise@gmail.com'
];

const OFFICIAL_EMAIL = 'compagnie@baldebraise.com';
const BRAND_NAME = 'Compagnie BalDeBraise';
const LOGO_URL = 'https://baldebraise.com/assets/media/logos/logo_v2_clean.png';
const SITE_URL = 'https://baldebraise.com';
const PHONE_NUMBER = '+33 7 86 62 75 92';

function encodeClientTag(clientEmail) {
  return (clientEmail || '').trim().replace(/@/g, '=');
}

function decodeClientTag(tag) {
  return (tag || '').trim().replace(/=/g, '@');
}

// Extraction robuste du message et des métadonnées du devis
function extractCleanMessageAndQuote(rawMime) {
  if (!rawMime) return { replyText: 'Bonjour, voici notre retour concernant votre demande.', quoteInfo: null };

  // 1. Séparation des entêtes et du corps du message
  let body = rawMime;
  if (rawMime.includes('\r\n\r\n')) {
    body = rawMime.split('\r\n\r\n').slice(1).join('\r\n\r\n');
  } else if (rawMime.includes('\n\n')) {
    body = rawMime.split('\n\n').slice(1).join('\n\n');
  }

  // 2. Si le message est au format multipart, extraire la partie text/plain
  if (body.includes('Content-Type: text/plain')) {
    const parts = body.split(/--[^\r\n]+/);
    for (const p of parts) {
      if (p.includes('Content-Type: text/plain')) {
        const sub = p.split(/\r?\n\r?\n/).slice(1).join('\n');
        if (sub.trim()) {
          body = sub;
          break;
        }
      }
    }
  }

  // 3. Découpage pour isoler la réponse de la citation
  const quoteMarkers = [
    /On\s+[\w\s,:]+\s+at\s+[\d:]+\s*(?:AM|PM)?[\s\S]*?wrote:/i,
    /Le\s+[\w\s,.:]+a\s+écrit\s*:/i,
    /---------- Forwarded message ---------/i,
    /------------- Message transféré -------------/i,
    /BALDEBRAISE - DEMANDE DE DEVIS/i
  ];

  let replyText = body;
  let quoteBlock = '';

  for (const marker of quoteMarkers) {
    const match = body.match(marker);
    if (match && match.index !== undefined && match.index > 0) {
      replyText = body.substring(0, match.index).trim();
      quoteBlock = body.substring(match.index).trim();
      break;
    }
  }

  replyText = replyText.trim();

  // 4. Extraction des informations de devis depuis le bloc cité uniquement
  let quoteInfo = null;
  if (quoteBlock.includes('DEMANDE DE DEVIS') || quoteBlock.includes('DEVIS BALDEBRAISE')) {
    let requestDate = '';
    const dateMatch = quoteBlock.match(/(?:On\s+([\w\s,:]+?)\s+wrote:|Le\s+([\w\s,.:]+?)\s+a\s+écrit)/i);
    if (dateMatch) {
      requestDate = (dateMatch[1] || dateMatch[2] || '').trim();
    }

    const eventTypeMatch = quoteBlock.match(/(?:DEMANDE DE DEVIS\s*\n\s*([^\n]+)|Formule\s*:\s*([^\n]+))/i);
    const clientMatch = quoteBlock.match(/CLIENT\s*:\s*([^\n]+)|CLIENT\s*([^\n]+)/i);
    const phoneMatch = quoteBlock.match(/TÉLÉPHONE\s*:\s*([^\n]+)|TÉLÉPHONE\s*([^\n]+)/i);
    const dateFieldMatch = quoteBlock.match(/DATE\s*:\s*([^\n]+)|DATE\s*([^\n]+)/i);
    const locationMatch = quoteBlock.match(/LIEU\s*:\s*([^\n]+)|LIEU\s*([^\n]+)/i);
    const msgMatch = quoteBlock.match(/MESSAGE\s*:\s*([\s\S]*?)(?:BalDeBraise|Reçu depuis|--|$)|MESSAGE\s*([\s\S]*?)(?:BalDeBraise|Reçu depuis|--|$)/i);

    const rawMsg = (msgMatch ? (msgMatch[1] || msgMatch[2] || '') : '').trim();

    quoteInfo = {
      requestDate: requestDate,
      eventType: eventTypeMatch ? (eventTypeMatch[1] || eventTypeMatch[2] || '').trim() : '',
      clientName: clientMatch ? (clientMatch[1] || clientMatch[2] || '').trim() : '',
      phone: phoneMatch ? (phoneMatch[1] || phoneMatch[2] || '').trim() : '',
      eventDate: dateFieldMatch ? (dateFieldMatch[1] || dateFieldMatch[2] || '').trim() : '',
      location: locationMatch ? (locationMatch[1] || locationMatch[2] || '').trim() : '',
      initialMessage: rawMsg === 'Aucune précision.' ? '' : rawMsg
    };
  }

  return {
    replyText: replyText || 'Bonjour, voici notre retour concernant votre demande.',
    quoteInfo
  };
}

// Template VIP BalDeBraise avec condensé chic
function buildVipResponseTemplate(userReply, quoteInfo, subject) {
  const cleanReplyHtml = userReply
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  let quoteSummaryHtml = '';
  if (quoteInfo && (quoteInfo.eventType || quoteInfo.location || quoteInfo.initialMessage)) {
    quoteSummaryHtml = `
      <div style="margin-top: 28px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 85, 0, 0.25); border-left: 4px solid #FF5500; border-radius: 10px; padding: 18px 20px;">
        <div style="color: #FFAA00; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
          📋 Rappel de votre demande de devis ${quoteInfo.requestDate ? '(' + quoteInfo.requestDate + ')' : ''}
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13.5px; color: #94A3B8;">
          ${quoteInfo.eventType ? `<tr><td style="padding: 4px 0; width: 120px; color: #64748B;">Événement :</td><td style="color: #F0F4FC; font-weight: 600;">${quoteInfo.eventType}</td></tr>` : ''}
          ${quoteInfo.location ? `<tr><td style="padding: 4px 0; color: #64748B;">Lieu / Dép. :</td><td style="color: #F0F4FC; font-weight: 600;">${quoteInfo.location}</td></tr>` : ''}
          ${quoteInfo.eventDate && quoteInfo.eventDate !== 'Non spécifiée' ? `<tr><td style="padding: 4px 0; color: #64748B;">Date prévue :</td><td style="color: #F0F4FC; font-weight: 600;">${quoteInfo.eventDate}</td></tr>` : ''}
          ${quoteInfo.initialMessage ? `<tr><td style="padding: 6px 0 0 0; color: #64748B; vertical-align: top;">Précisions :</td><td style="padding: 6px 0 0 0; color: #CBD5E1; font-style: italic;">« ${quoteInfo.initialMessage} »</td></tr>` : ''}
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
    // CAS 1 : VOUS RÉPONDEZ DEPUIS VOTRE GMAIL GÉRANT (ciebaldebraise@gmail.com)
    // =========================================================================
    const isOwner = OWNER_EMAILS.some(owner => sender.includes(owner.toLowerCase()));
    const isRelayReply = recipient.includes('relais+') || recipient.includes('reply+');

    if (isRelayReply) {
      if (!isOwner) {
        console.warn(`⛔ [Sécurité] Expéditeur [${sender}] non autorisé.`);
        return;
      }

      console.log('⚡ [Relais Vérifié] Expéditeur propriétaire validé -> Traitement...');

      // Extraction de l'email client depuis relais+client=domaine.com@baldebraise.com
      const match = recipient.match(/(?:relais|reply)\+([^@>]+)@/i);
      if (!match || !match[1]) {
        console.error('❌ Impossible de décoder l\'email client depuis :', recipient);
        return;
      }

      const clientEmail = decodeClientTag(match[1]);
      console.log(`🎯 Email client cible : ${clientEmail}`);

      let rawMime = '';
      try {
        rawMime = await readRawText(message.raw);
      } catch(e) {
        console.error('Erreur lecture MIME:', e.message);
      }

      const { replyText, quoteInfo } = extractCleanMessageAndQuote(rawMime);
      const cleanSubject = rawSubject.startsWith('Re:') ? rawSubject : `Re: ${rawSubject}`;
      const htmlContent = buildVipResponseTemplate(replyText, quoteInfo, cleanSubject);

      // Expédition vers le client avec l'expéditeur officiel compagnie@baldebraise.com
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
            value: replyText
          }
        ]
      };

      try {
        const sendRes = await fetch('https://api.mailchannels.net/tx/v1/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mailchannelsPayload)
        });

        const resBody = await sendRes.text();
        console.log(`📤 Statut d'envoi MailChannels : HTTP ${sendRes.status} (${resBody.substring(0, 80)})`);
      } catch(err) {
        console.error('❌ Erreur expédition MailChannels:', err.message);
      }
      return;
    }

    // =========================================================================
    // CAS 2 : UN CLIENT ÉCRIT DIRECTEMENT À COMPAGNIE@BALDEBRAISE.COM
    // =========================================================================
    console.log('📬 Réception d\'un message client -> Transfert vers ciebaldebraise@gmail.com');

    const clientTag = encodeClientTag(sender);
    const relayReplyTo = `relais+${clientTag}@baldebraise.com`;

    try {
      await message.forward(OWNER_EMAILS[0], new Headers({
        'Reply-To': relayReplyTo,
        'X-BalDeBraise-Client': sender
      }));
      console.log(`✅ Message transféré à ${OWNER_EMAILS[0]} avec Reply-To: ${relayReplyTo}`);
    } catch(err) {
      console.error('❌ Erreur transfert message.forward:', err.message);
    }
  }
};
