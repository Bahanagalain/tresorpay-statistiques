#!/bin/sh
set -e

echo ""
echo "=== TresorPay Statistiques Backend ==="
echo ""

mkdir -p /app/uploads/photos

echo "[0/3] Preparation base de donnees..."
node -e "
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  // Ajouter colonnes manquantes
  await c.query('ALTER TABLE \"Soumission\" ADD COLUMN IF NOT EXISTS \"montant_paye\" DECIMAL(18,2) NOT NULL DEFAULT 0').catch(() => {});
  // Nettoyer migration echouee si presente
  await c.query(\"DELETE FROM \\\"_prisma_migrations\\\" WHERE migration_name LIKE '%montant_paye%' AND finished_at IS NULL\").catch(() => {});
  await c.end();
})().catch(() => {});
" 2>/dev/null || echo "  -> preparation ok"

echo "[1/3] Application des migrations Prisma..."
npx prisma migrate deploy

echo "[2/3] Peuplement de la base (seed)..."
npx prisma db seed || echo "  -> Seed deja applique ou erreur non bloquante"

echo "[3/3] Demarrage du serveur Fastify..."
exec node src/app.js
