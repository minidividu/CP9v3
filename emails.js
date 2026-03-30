const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const fromEmail = process.env.SMTP_FROM || 'bureau@cp9squadra.com';
const adminEmail = process.env.SMTP_TO || "youngazurvision@gmail.com";

// Style CSS réutilisable pour un rendu pro
const emailStyle = `
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  color: #1a1a1a;
  line-height: 1.6;
  max-width: 600px;
  margin: 0 auto;
  padding: 25px;
  border: 1px solid #f0f0f0;
  border-radius: 12px;
  background-color: #ffffff;
`;

// 1. DEMANDE D'ÉVÉNEMENT (ADMIN + CLIENT)
const sendEventRequestEmails = async (name, email, phone, city, date, eventType, budget, message) => {
  if (!resend) throw new Error("Service Resend non configuré");

  const typeLabels = {
    club: "Soirée en club / bar",
    etudiant: "Soirée étudiante / BDE",
    festival: "Festival / open air",
    prive: "Événement privé",
    autre: "Autre"
  };

  return await Promise.all([
    // --- MAIL POUR L'ADMIN (VOUS) ---
    resend.emails.send({
      from: fromEmail,
      to: adminEmail,
      subject: `🔥 NOUVEAU BOOKING : ${name} - ${city}`,
      html: `
        <div style="${emailStyle}">
          <h2 style="color: #000; border-bottom: 2px solid #000; padding-bottom: 10px; margin-top: 0;">Nouvelle demande de booking</h2>
          
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0;"><strong>👤 Nom / Structure :</strong></td><td>${name}</td></tr>
            <tr><td style="padding: 8px 0;"><strong>📧 Email :</strong></td><td><a href="mailto:${email}">${email}</a></td></tr>
            <tr><td style="padding: 8px 0;"><strong>📞 Téléphone :</strong></td><td>${phone}</td></tr>
            <tr><td style="padding: 8px 0;"><strong>📍 Ville :</strong></td><td>${city}</td></tr>
            <tr><td style="padding: 8px 0;"><strong>📅 Date prévue :</strong></td><td>${date}</td></tr>
            <tr><td style="padding: 8px 0;"><strong>🎭 Type :</strong></td><td>${typeLabels[eventType] || eventType}</td></tr>
            <tr><td style="padding: 8px 0;"><strong>💰 Budget :</strong></td><td>${budget ? budget + '€' : 'Non précisé'}</td></tr>
          </table>

          <div style="margin-top: 20px; padding: 15px; background-color: #f9f9f9; border-left: 4px solid #000; border-radius: 4px;">
            <p style="margin-top: 0;"><strong>💬 Message / Détails :</strong></p>
            <p style="white-space: pre-wrap; margin-bottom: 0;">${message}</p>
          </div>
          
          <p style="font-size: 12px; color: #888; margin-top: 25px; text-align: center;">
            Requête envoyée depuis cp9squadra.com
          </p>
        </div>
      `,
    }),

    // --- MAIL POUR LE CLIENT (CONFIRMATION) ---
    resend.emails.send({
      from: fromEmail,
      to: email,
      subject: "Confirmation de demande - CP09 Squadra",
      html: `
        <div style="${emailStyle} text-align: center;">
          <h1 style="margin-top: 0; letter-spacing: 2px;">CP09 SQUADRA</h1>
          <p>Bonjour <strong>${name}</strong>,</p>
          <p>Nous avons bien reçu votre demande pour votre événement à <strong>${city}</strong> le <strong>${date}</strong>.</p>
          <p>Notre équipe va étudier votre projet et reviendra vers vous très prochainement par mail ou par téléphone au <strong>${phone}</strong>.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 25px 0;">
          <p style="font-size: 14px; color: #666;">Merci de votre confiance.</p>
          <a href="https://cp9squadra.com" style="display: inline-block; background-color: #000; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 10px;">Voir la boutique</a>
        </div>
      `,
    })
  ]);
};

// 2. NEWSLETTER
const sendNewsletterEmail = async (email) => {
  if (!resend) return;
  return await resend.emails.send({
    from: fromEmail,
    to: email,
    subject: "Bienvenue dans la Squadra CP09 !",
    html: `
      <div style="${emailStyle} text-align: center;">
        <h1 style="color: #000;">CP09 SQUADRA</h1>
        <h2 style="margin-top: 20px;">Inscription confirmée !</h2>
        <p>Merci de rejoindre notre newsletter. Vous recevrez désormais en priorité nos annonces de concerts, nos nouveaux drops et nos exclusivités.</p>
        <p style="font-size: 12px; color: #999; margin-top: 30px;">
          Vous recevez ce mail car vous vous êtes inscrit sur cp9squadra.com
        </p>
      </div>
    `,
  });
};

// 3. CONFIRMATION DE COMMANDE (BOUTIQUE)
const sendOrderConfirmation = async (email, orderDetails) => {
  if (!resend) return;
  
  const itemsHtml = orderDetails.items.map(item => 
    `<tr style="border-bottom: 1px solid #f0f0f0;">
      <td style="padding: 12px 0;">${item.quantite}x Produit (Taille: ${item.taille})</td>
      <td style="padding: 12px 0; text-align: right; font-weight: bold;">${(item.prix_unitaire / 100).toFixed(2)}€</td>
    </tr>`
  ).join('');

  return await resend.emails.send({
    from: fromEmail,
    to: email,
    subject: "Votre commande CP09 Squadra est validée",
    html: `
      <div style="${emailStyle}">
        <h2 style="text-align: center; text-transform: uppercase;">Merci pour votre achat</h2>
        <p>Bonjour, votre commande a été confirmée et sera préparée avec soin.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="border-bottom: 2px solid #000;">
              <th style="padding: 10px 0; text-align: left;">Article</th>
              <th style="padding: 10px 0; text-align: right;">Prix</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        
        <div style="text-align: right; font-size: 18px; margin-top: 10px;">
          <strong>Total : ${(orderDetails.totalAmount / 100).toFixed(2)}€</strong>
        </div>

        <div style="margin-top: 40px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; padding-top: 20px;">
          CP09 SQUADRA - bureau@cp9squadra.com<br>
          Expédié depuis la France
        </div>
      </div>
    `,
  });
};

module.exports = { sendEventRequestEmails, sendNewsletterEmail, sendOrderConfirmation };
