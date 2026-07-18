#!/bin/sh
set -e

echo ""
echo "=== TresorPay Statistiques Backend ==="
echo ""

mkdir -p /app/uploads/photos

echo "[1/3] Application des migrations Prisma..."
npx prisma migrate deploy

echo "[2/3] Peuplement de la base (seed)..."
npx prisma db seed || echo "  -> Seed deja applique ou erreur non bloquante"

echo "[3/3] Demarrage du serveur Fastify..."
exec node src/app.js
