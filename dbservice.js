/**
 * Enregistre une commande complète en base de données
 */
const saveOrder = async (pool, { customerEmail, totalAmount, items, stripeSessionId }) => {
  if (!pool) throw new Error("Base de données non connectée");

  const client = await pool.connect();
  try {
    await client.query('BEGIN'); // Début de la transaction

    // 1. Trouver ou Créer le client
    const customerRes = await client.query(
      `INSERT INTO clients (email) VALUES ($1) 
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING id`,
      [customerEmail]
    );
    const clientId = customerRes.rows[0].id;

    // 2. Créer l'ordre (la commande)
    const orderRes = await client.query(
      `INSERT INTO ordres (client_id, total_cents, statut, stripe_session_id) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [clientId, totalAmount, 'payé', stripeSessionId]
    );
    const orderId = orderRes.rows[0].id;

    // 3. Insérer les articles commandés
    for (const item of items) {
      await client.query(
        `INSERT INTO articles_commandés (ordre_id, produit_id, taille, quantite, prix_unitaire_cents) 
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, item.produit_id, item.taille, item.quantite, item.prix_unitaire]
      );
    }

    await client.query('COMMIT'); // Validation de la transaction
    return orderId;
  } catch (e) {
    await client.query('ROLLBACK'); // Annulation en cas d'erreur
    throw e;
  } finally {
    client.release();
  }
};

module.exports = { saveOrder };
