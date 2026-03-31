require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const { put, handleUpload } = require("@vercel/blob");

const { sendEventRequestEmails, sendNewsletterEmail, sendOrderConfirmation } = require("./emails.js");
const { saveOrder } = require("./dbservice.js");

const app = express();

const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
}) : null;

const stripe = process.env.STRIPE_SECRET_KEY ? require("stripe")(process.env.STRIPE_SECRET_KEY) : null;

// --- MIDDLEWARES ---
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

app.use((req, res, next) => {
  if (req.originalUrl === "/webhook") next();
  else express.json({ limit: "10mb" })(req, res, next);
});

// --- ROUTE CONFIG ---
app.get("/config", (req, res) => {
  res.json({ stripePublicKey: process.env.STRIPE_PUBLIC_KEY || "" });
});

// ==========================================
// SAMPLE BOX — BLOB UPLOAD TOKEN
// ==========================================
app.post("/api/upload-token", async (req, res) => {
  try {
    const response = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname) => ({
        allowedContentTypes: ["application/zip", "application/x-zip-compressed", "application/octet-stream"],
        maximumSizeInBytes: 200 * 1024 * 1024,
      }),
      onUploadCompleted: async ({ blob }) => {
        console.log("✅ Blob upload complete:", blob.url);
      },
    });
    res.json(response);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// SAMPLE BOX — CREATE PACK
// ==========================================
app.post("/create-pack", async (req, res) => {
  const { title, email, priceCents, blobUrl } = req.body;
  if (!title || !email || !priceCents || !blobUrl) {
    return res.status(400).json({ message: "Données manquantes." });
  }
  try {
    const result = await pool.query(
      `INSERT INTO packs (title, vendor_email, price_cents, blob_url, active)
       VALUES ($1, $2, $3, $4, false) RETURNING id`,
      [title, email.trim().toLowerCase(), priceCents, blobUrl]
    );
    res.json({ packId: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// SAMPLE BOX — ACTIVATION VENDEUR (9€)
// ==========================================
app.post("/create-activation-session", async (req, res) => {
  const { packId } = req.body;
  if (!packId) return res.status(400).json({ message: "packId requis." });
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "eur",
          unit_amount: 900,
          product_data: { name: "Activation Sample Pack — CP9 Tools" }
        },
        quantity: 1
      }],
      metadata: { type: "pack_activation", packId: String(packId) },
      success_url: `${req.headers.origin}/vendor-succes.html?pack_id=${packId}`,
      cancel_url: `${req.headers.origin}/vendor-upload.html`,
    });
    res.json({ id: session.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// SAMPLE BOX — GET PACK INFO (public)
// ==========================================
app.get("/api/pack/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, title, price_cents FROM packs WHERE id = $1 AND active = true",
      [req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: "Pack introuvable." });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// SAMPLE BOX — ACHAT ACHETEUR
// ==========================================
app.post("/create-pack-session", async (req, res) => {
  const { packId, buyerEmail } = req.body;
  if (!packId || !buyerEmail) return res.status(400).json({ message: "Données manquantes." });
  try {
    const result = await pool.query(
      "SELECT id, title, price_cents FROM packs WHERE id = $1 AND active = true",
      [packId]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: "Pack introuvable." });
    const pack = result.rows[0];

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: buyerEmail,
      line_items: [{
        price_data: {
          currency: "eur",
          unit_amount: pack.price_cents,
          product_data: { name: pack.title }
        },
        quantity: 1
      }],
      metadata: { type: "pack_purchase", packId: String(packId), buyerEmail },
      success_url: `${req.headers.origin}/sample-succes.html?token=PENDING`,
      cancel_url: `${req.headers.origin}/sample-page.html?id=${packId}`,
    });
    res.json({ id: session.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// SAMPLE BOX — DOWNLOAD TOKEN
// ==========================================
app.get("/download/:token", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT dt.used, dt.expires_at, p.blob_url, p.title
       FROM download_tokens dt
       JOIN packs p ON p.id = dt.pack_id
       WHERE dt.token = $1`,
      [req.params.token]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: "Lien invalide." });
    const row = result.rows[0];
    if (row.used) return res.status(410).json({ message: "Lien déjà utilisé." });
    if (new Date() > new Date(row.expires_at)) return res.status(410).json({ message: "Lien expiré." });

    await pool.query("UPDATE download_tokens SET used = true WHERE token = $1", [req.params.token]);

    res.json({
      url: row.blob_url,
      filename: row.title.replace(/[^a-z0-9]/gi, '_') + '.zip'
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- ROUTE ÉVÉNEMENT ---
app.post("/event-request", async (req, res) => {
  const { name, email, phone, city, date, eventType, budget, message } = req.body;
  try {
    await sendEventRequestEmails(name, email, phone, city, date, eventType, budget, message);
    res.json({ message: "Votre demande a été envoyée avec succès !" });
  } catch (err) {
    console.error("❌ Erreur Route Event:", err.message);
    res.status(500).json({ message: "Erreur lors de l'envoi de l'e-mail." });
  }
});

// --- ROUTE NEWSLETTER ---
app.post("/subscribe", async (req, res) => {
  const email = req.body.email?.trim().toLowerCase();
  if (!email) return res.status(400).json({ message: "Email requis." });
  try {
    const result = await pool.query(
      `INSERT INTO newsletter_subscriptions(email) VALUES ($1) ON CONFLICT DO NOTHING RETURNING *`,
      [email]
    );
    if (result.rowCount > 0) {
      await sendNewsletterEmail(email);
      res.json({ message: "Inscription réussie !" });
    } else {
      res.json({ message: "Vous êtes déjà inscrit à la newsletter." });
    }
  } catch (err) {
    res.status(500).json({ message: "Erreur technique, réessayez plus tard." });
  }
});

// --- ROUTE SHOP ---
app.post("/create-checkout-session", async (req, res) => {
  const { items } = req.body;
  try {
    const simplifiedItems = items.map(i => ({
      produit_id: i.id, taille: i.size || 'N/A',
      quantite: i.qty, prix_unitaire: Math.round(i.price * 100)
    }));
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: items.map(i => ({
        price_data: {
          currency: "eur", unit_amount: Math.round(i.price * 100),
          product_data: { name: i.title }
        },
        quantity: i.qty
      })),
      metadata: { type: "shop", cartItems: JSON.stringify(simplifiedItems) },
      success_url: `${req.headers.origin}/succes.html`,
      cancel_url: `${req.headers.origin}/shop.html`,
    });
    res.json({ id: session.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- ROUTE GENERATOR (5€) ---
app.post("/create-generator-session", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "eur", unit_amount: 500,
          product_data: { name: "Cover HD 3000×3000 — CP9 Generator" }
        },
        quantity: 1
      }],
      metadata: { type: "generator" },
      success_url: `${req.headers.origin}/generator-succes.html`,
      cancel_url: `${req.headers.origin}/generator.html`,
    });
    res.json({ id: session.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// WEBHOOK
// ==========================================
app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const type = session.metadata?.type;

    try {
      // --- Activation vendeur ---
      if (type === "pack_activation") {
        const packId = session.metadata.packId;
        await pool.query("UPDATE packs SET active = true, stripe_activation_session = $1 WHERE id = $2",
          [session.id, packId]);
        console.log(`✅ Pack #${packId} activé`);
      }

      // --- Achat acheteur ---
      else if (type === "pack_purchase") {
        const { packId, buyerEmail } = session.metadata;
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

        await pool.query(
          `INSERT INTO download_tokens (token, pack_id, buyer_email, used, expires_at)
           VALUES ($1, $2, $3, false, $4)`,
          [token, packId, buyerEmail, expiresAt]
        );

        // Envoyer email avec lien de téléchargement
        const downloadLink = `${process.env.SITE_URL || 'https://cp9tools.vercel.app'}/sample-succes.html?token=${token}`;
        const packResult = await pool.query("SELECT title FROM packs WHERE id = $1", [packId]);
        const packTitle = packResult.rows[0]?.title || 'Sample Pack';

        const { Resend } = require('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: process.env.SMTP_FROM || 'bureau@cp9squadra.com',
          to: buyerEmail,
          subject: `🎵 Ton pack "${packTitle}" est prêt à télécharger`,
          html: `
            <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:30px;">
              <h2 style="color:#000;">Merci pour ton achat !</h2>
              <p>Ton pack <strong>${packTitle}</strong> est disponible pendant 24h.</p>
              <a href="${downloadLink}" style="display:inline-block;background:#ff2d2d;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;margin:20px 0;">
                Télécharger mon pack
              </a>
              <p style="font-size:12px;color:#888;">Ce lien expire dans 24h. Télécharge dès maintenant.</p>
            </div>
          `,
        });
        console.log(`✅ Token de téléchargement envoyé à ${buyerEmail}`);
      }

      // --- Shop ---
      else if (type === "shop" || session.metadata?.cartItems) {
        const items = JSON.parse(session.metadata.cartItems);
        await saveOrder(pool, {
          customerEmail: session.customer_details.email,
          totalAmount: session.amount_total,
          stripeSessionId: session.id,
          items
        });
        await sendOrderConfirmation(session.customer_details.email, { items, totalAmount: session.amount_total });
      }

    } catch (err) {
      console.error("❌ Erreur Webhook:", err.message);
    }
  }

  res.json({ received: true });
});

module.exports = app;

if (process.env.NODE_ENV !== 'production') {
  app.listen(3000, () => console.log("✅ Serveur lancé sur http://localhost:3000"));
}
