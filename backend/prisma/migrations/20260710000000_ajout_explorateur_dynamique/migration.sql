-- CreateEnum
CREATE TYPE "TypeChamp" AS ENUM ('SELECT', 'MULTI_SELECT', 'TEXT', 'NUMBER', 'BOOLEAN');

-- CreateTable
CREATE TABLE "champs_formulaire" (
    "id" SERIAL NOT NULL,
    "formulaire_id" VARCHAR(60) NOT NULL,
    "service_id" TEXT,
    "cle_champ" VARCHAR(200) NOT NULL,
    "libelle_champ" VARCHAR(300) NOT NULL,
    "libelle_champ_en" VARCHAR(300),
    "type_champ" "TypeChamp" NOT NULL DEFAULT 'TEXT',
    "est_dimension" BOOLEAN NOT NULL DEFAULT false,
    "est_champ_paiement" BOOLEAN NOT NULL DEFAULT false,
    "options_disponibles" JSONB,
    "ordre_affichage" INTEGER NOT NULL DEFAULT 0,
    "synchronise_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "champs_formulaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "valeurs_soumission" (
    "id" SERIAL NOT NULL,
    "soumission_id" INTEGER NOT NULL,
    "champ_formulaire_id" INTEGER NOT NULL,
    "valeur" VARCHAR(500),
    "valeur_numerique" DOUBLE PRECISION,
    "synchronise_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "valeurs_soumission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "champs_formulaire_service_id_idx" ON "champs_formulaire"("service_id");

-- CreateIndex
CREATE INDEX "champs_formulaire_est_dimension_idx" ON "champs_formulaire"("est_dimension");

-- CreateIndex
CREATE UNIQUE INDEX "champs_formulaire_formulaire_id_cle_champ_key" ON "champs_formulaire"("formulaire_id", "cle_champ");

-- CreateIndex
CREATE INDEX "valeurs_soumission_champ_formulaire_id_valeur_idx" ON "valeurs_soumission"("champ_formulaire_id", "valeur");

-- CreateIndex
CREATE INDEX "valeurs_soumission_soumission_id_idx" ON "valeurs_soumission"("soumission_id");

-- CreateIndex
CREATE UNIQUE INDEX "valeurs_soumission_soumission_id_champ_formulaire_id_key" ON "valeurs_soumission"("soumission_id", "champ_formulaire_id");

-- AddForeignKey
ALTER TABLE "champs_formulaire" ADD CONSTRAINT "champs_formulaire_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services_gouv"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valeurs_soumission" ADD CONSTRAINT "valeurs_soumission_soumission_id_fkey" FOREIGN KEY ("soumission_id") REFERENCES "soumissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valeurs_soumission" ADD CONSTRAINT "valeurs_soumission_champ_formulaire_id_fkey" FOREIGN KEY ("champ_formulaire_id") REFERENCES "champs_formulaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;
