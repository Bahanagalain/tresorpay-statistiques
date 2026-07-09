-- CreateEnum
CREATE TYPE "StatutPartenaire" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');
CREATE TYPE "StatutDemandePartenaire" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID', 'FAILED', 'EXPIRED', 'CALLBACK_SENT', 'CALLBACK_FAILED');
CREATE TYPE "ActionAudit" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'SUBMIT', 'PUBLISH', 'APPROVE', 'REJECT', 'LOGIN', 'ACTIVATE', 'DEACTIVATE');

-- AlterTable services_gouv
ALTER TABLE "services_gouv" ADD COLUMN IF NOT EXISTS "groupe_revenu_id" TEXT;
ALTER TABLE "services_gouv" ADD COLUMN IF NOT EXISTS "service_code" VARCHAR(50);

-- CreateTable groupes_revenu
CREATE TABLE "groupes_revenu" (
    "id" TEXT NOT NULL,
    "nom_fr" VARCHAR(200) NOT NULL,
    "nom_en" VARCHAR(200),
    "ministere_id" TEXT,
    "est_actif" BOOLEAN NOT NULL DEFAULT true,
    "synchronise_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "groupes_revenu_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "groupes_revenu_ministere_id_idx" ON "groupes_revenu"("ministere_id");

-- CreateTable beneficiaires
CREATE TABLE "beneficiaires" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "nom" VARCHAR(200) NOT NULL,
    "rib" VARCHAR(50),
    "est_actif" BOOLEAN NOT NULL DEFAULT true,
    "synchronise_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "beneficiaires_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "beneficiaires_code_key" ON "beneficiaires"("code");

-- CreateTable service_beneficiaires
CREATE TABLE "service_beneficiaires" (
    "id" SERIAL NOT NULL,
    "service_id" TEXT NOT NULL,
    "beneficiaire_id" TEXT NOT NULL,
    "pourcentage" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "synchronise_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "service_beneficiaires_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "service_beneficiaires_service_id_beneficiaire_id_key" ON "service_beneficiaires"("service_id", "beneficiaire_id");

-- CreateTable districts_financiers
CREATE TABLE "districts_financiers" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "nom_fr" VARCHAR(200) NOT NULL,
    "nom_en" VARCHAR(200),
    "type" VARCHAR(10),
    "code_poste" VARCHAR(20),
    "est_actif" BOOLEAN NOT NULL DEFAULT true,
    "synchronise_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "districts_financiers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "districts_financiers_code_key" ON "districts_financiers"("code");

-- CreateTable postes_comptables
CREATE TABLE "postes_comptables" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "nom_fr" VARCHAR(200) NOT NULL,
    "nom_en" VARCHAR(200),
    "district_financier_id" TEXT,
    "org_unit_id" TEXT,
    "est_actif" BOOLEAN NOT NULL DEFAULT true,
    "synchronise_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "postes_comptables_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "postes_comptables_code_key" ON "postes_comptables"("code");
CREATE INDEX "postes_comptables_district_financier_id_idx" ON "postes_comptables"("district_financier_id");
CREATE INDEX "postes_comptables_org_unit_id_idx" ON "postes_comptables"("org_unit_id");

-- CreateTable types_structure
CREATE TABLE "types_structure" (
    "id" TEXT NOT NULL,
    "nom_fr" VARCHAR(200) NOT NULL,
    "nom_en" VARCHAR(200),
    "description" TEXT,
    "est_actif" BOOLEAN NOT NULL DEFAULT true,
    "synchronise_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "types_structure_pkey" PRIMARY KEY ("id")
);

-- CreateTable structures
CREATE TABLE "structures" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "nom_fr" VARCHAR(200) NOT NULL,
    "nom_en" VARCHAR(200),
    "type_structure_id" TEXT,
    "ministere_id" TEXT,
    "org_unit_id" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "est_actif" BOOLEAN NOT NULL DEFAULT true,
    "synchronise_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "structures_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "structures_code_key" ON "structures"("code");
CREATE INDEX "structures_type_structure_id_idx" ON "structures"("type_structure_id");
CREATE INDEX "structures_ministere_id_idx" ON "structures"("ministere_id");
CREATE INDEX "structures_org_unit_id_idx" ON "structures"("org_unit_id");

-- CreateTable plateformes_partenaire
CREATE TABLE "plateformes_partenaire" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "nom" VARCHAR(200) NOT NULL,
    "ministere_id" TEXT,
    "contact_email" VARCHAR(200),
    "logo_url" VARCHAR(500),
    "statut" "StatutPartenaire" NOT NULL DEFAULT 'ACTIVE',
    "callback_url" VARCHAR(500),
    "callback_retries" INTEGER NOT NULL DEFAULT 3,
    "est_actif" BOOLEAN NOT NULL DEFAULT true,
    "synchronise_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "plateformes_partenaire_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "plateformes_partenaire_code_key" ON "plateformes_partenaire"("code");
CREATE INDEX "plateformes_partenaire_ministere_id_idx" ON "plateformes_partenaire"("ministere_id");

-- CreateTable demandes_partenaire
CREATE TABLE "demandes_partenaire" (
    "id" SERIAL NOT NULL,
    "external_id" VARCHAR(60),
    "plateforme_id" TEXT NOT NULL,
    "platform_reference" VARCHAR(100),
    "service_id" VARCHAR(60),
    "unique_code" VARCHAR(30),
    "montant" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "montant_paye" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "statut" "StatutDemandePartenaire" NOT NULL DEFAULT 'PENDING',
    "methode_paiement" VARCHAR(50),
    "operateur_paiement" VARCHAR(50),
    "payeur_nom" VARCHAR(200),
    "raison_echec" VARCHAR(500),
    "callback_statut_http" INTEGER,
    "callback_tentatives" INTEGER NOT NULL DEFAULT 0,
    "paye_le" TIMESTAMPTZ,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "synchronise_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "demandes_partenaire_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "demandes_partenaire_external_id_key" ON "demandes_partenaire"("external_id");
CREATE INDEX "demandes_partenaire_plateforme_id_idx" ON "demandes_partenaire"("plateforme_id");
CREATE INDEX "demandes_partenaire_statut_idx" ON "demandes_partenaire"("statut");
CREATE INDEX "demandes_partenaire_cree_le_idx" ON "demandes_partenaire"("cree_le");

-- CreateTable transactions_partenaire
CREATE TABLE "transactions_partenaire" (
    "id" SERIAL NOT NULL,
    "external_id" VARCHAR(60),
    "demande_id" INTEGER NOT NULL,
    "montant" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "statut" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "corebank_ref" VARCHAR(100),
    "paye_le" TIMESTAMPTZ,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "synchronise_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "transactions_partenaire_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "transactions_partenaire_external_id_key" ON "transactions_partenaire"("external_id");
CREATE INDEX "transactions_partenaire_demande_id_idx" ON "transactions_partenaire"("demande_id");

-- CreateTable utilisateurs_citoyen
CREATE TABLE "utilisateurs_citoyen" (
    "id" SERIAL NOT NULL,
    "external_id" VARCHAR(60),
    "email" VARCHAR(200),
    "telephone" VARCHAR(30),
    "prenom" VARCHAR(100),
    "nom" VARCHAR(100),
    "est_verifie" BOOLEAN NOT NULL DEFAULT false,
    "est_actif" BOOLEAN NOT NULL DEFAULT true,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "synchronise_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "utilisateurs_citoyen_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "utilisateurs_citoyen_external_id_key" ON "utilisateurs_citoyen"("external_id");

-- CreateTable journal_audit
CREATE TABLE "journal_audit" (
    "id" SERIAL NOT NULL,
    "external_id" VARCHAR(60),
    "acteur_email" VARCHAR(200),
    "acteur_nom" VARCHAR(200),
    "action" "ActionAudit" NOT NULL,
    "type_entite" VARCHAR(60),
    "entite_id" VARCHAR(60),
    "methode_http" VARCHAR(10),
    "chemin_route" VARCHAR(300),
    "metadata" JSONB,
    "execute_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "synchronise_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "journal_audit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "journal_audit_external_id_key" ON "journal_audit"("external_id");
CREATE INDEX "journal_audit_execute_le_idx" ON "journal_audit"("execute_le");
CREATE INDEX "journal_audit_action_idx" ON "journal_audit"("action");
CREATE INDEX "journal_audit_type_entite_idx" ON "journal_audit"("type_entite");

-- CreateTable config_sync
CREATE TABLE "config_sync" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "intervalle_ms" INTEGER NOT NULL DEFAULT 600000,
    "est_active" BOOLEAN NOT NULL DEFAULT true,
    "derniere_sync_complete" TIMESTAMPTZ,
    "modifie_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "config_sync_pkey" PRIMARY KEY ("id")
);

-- Insert default config
INSERT INTO "config_sync" ("id", "intervalle_ms", "est_active") VALUES (1, 600000, true) ON CONFLICT DO NOTHING;

-- AddForeignKey
ALTER TABLE "services_gouv" ADD CONSTRAINT "services_gouv_groupe_revenu_id_fkey" FOREIGN KEY ("groupe_revenu_id") REFERENCES "groupes_revenu"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "services_gouv_groupe_revenu_id_idx" ON "services_gouv"("groupe_revenu_id");

ALTER TABLE "groupes_revenu" ADD CONSTRAINT "groupes_revenu_ministere_id_fkey" FOREIGN KEY ("ministere_id") REFERENCES "ministeres"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_beneficiaires" ADD CONSTRAINT "service_beneficiaires_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services_gouv"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_beneficiaires" ADD CONSTRAINT "service_beneficiaires_beneficiaire_id_fkey" FOREIGN KEY ("beneficiaire_id") REFERENCES "beneficiaires"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "postes_comptables" ADD CONSTRAINT "postes_comptables_district_financier_id_fkey" FOREIGN KEY ("district_financier_id") REFERENCES "districts_financiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "postes_comptables" ADD CONSTRAINT "postes_comptables_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "org_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "structures" ADD CONSTRAINT "structures_type_structure_id_fkey" FOREIGN KEY ("type_structure_id") REFERENCES "types_structure"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "structures" ADD CONSTRAINT "structures_ministere_id_fkey" FOREIGN KEY ("ministere_id") REFERENCES "ministeres"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "structures" ADD CONSTRAINT "structures_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "org_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "plateformes_partenaire" ADD CONSTRAINT "plateformes_partenaire_ministere_id_fkey" FOREIGN KEY ("ministere_id") REFERENCES "ministeres"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "demandes_partenaire" ADD CONSTRAINT "demandes_partenaire_plateforme_id_fkey" FOREIGN KEY ("plateforme_id") REFERENCES "plateformes_partenaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transactions_partenaire" ADD CONSTRAINT "transactions_partenaire_demande_id_fkey" FOREIGN KEY ("demande_id") REFERENCES "demandes_partenaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;
