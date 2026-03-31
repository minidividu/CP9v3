require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { Pool } = require("pg");

// Imports des services locaux
const { sendEventRequestEmails, sendNewsletterEmail, sendOrderConfirmation } = require("./emails.js");
const { saveOrder } = require("./dbservice.js");

const app = express();

// Configuration de la base de données
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
}) : null;

// Configuration Stripe
const stripe = process.env.STRIPE_SECRET_KEY ? require("stripe")(process.env.STRIPE_SECRET_KEY) : null;

// --- MIDDLEWARES ---
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

// Le Webhook a besoin du corps brut (raw), les autres routes du JSON
app.use((req, res, next) => {
  if (req.originalUrl === "/webhook") next();
  else express.json()(req, res, next);
});

// --- ROUTES ---

// --- ROUTE CONFIG (clé publique Stripe) ---
app.get("/config", (req, res) => {
  res.json({ stripePublicKey: process.env.STRIPE_PUBLIC_KEY || "" });
});

// --- ROUTE ÉVÉNEMENT (MISE À JOUR COMPLÈTE) ---
app.post("/event-request", async (req, res) => {
  // On récupère TOUTES les données envoyées par votre formulaire HTML
  const { name, email, phone, city, date, eventType, budget, message } = req.body;
  
  try {
    // On envoie tout à la fonction d'e-mail pour un récapitulatif complet
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

// --- ROUTE PAIEMENT (STRIPE) ---
app.post("/create-checkout-session", async (req, res) => {
  const { items } = req.body;
  try {
    const simplifiedItems = items.map(i => ({ 
      produit_id: i.id, 
      taille: i.size || 'N/A', 
      quantite: i.qty, 
      prix_unitaire: Math.round(i.price * 100) 
    }));

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: items.map(i => ({ 
        price_data: { 
          currency: "eur", 
          unit_amount: Math.round(i.price * 100), 
          product_data: { name: i.title } 
        }, 
        quantity: i.qty 
      })),
      metadata: { cartItems: JSON.stringify(simplifiedItems) },
      success_url: `${req.headers.origin}/succes.html`,
      cancel_url: `${req.headers.origin}/shop.html`,
    });
    res.json({ id: session.id });
  } catch (err) { 
    res.status(500).json({ message: err.message }); 
  }
});

// --- ROUTE GENERATOR (Stripe 5€) ---
app.post("/create-generator-session", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "eur",
          unit_amount: 500,
          product_data: { name: "Cover HD 3000×3000 — CP9 Generator" }
        },
        quantity: 1
      }],
      success_url: `${req.headers.origin}/generator-succes.html`,
      cancel_url: `${req.headers.origin}/generator.html`,
    });
    res.json({ id: session.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- WEBHOOK (STRIPE -> DATABASE) ---
app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) { 
    return res.status(400).send(`Webhook Error: ${err.message}`); 
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    try {
      const items = JSON.parse(session.metadata.cartItems);
      await saveOrder(pool, { 
        customerEmail: session.customer_details.email, 
        totalAmount: session.amount_total, 
        stripeSessionId: session.id, 
        items 
      });
      await sendOrderConfirmation(session.customer_details.email, { items, totalAmount: session.amount_total });
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

