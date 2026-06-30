-- CreateEnum
CREATE TYPE "Niveau" AS ENUM ('CENTRAL', 'REGIONAL', 'DEPARTEMENTAL');
CREATE TYPE "StatutSync" AS ENUM ('SUCCES', 'ECHEC');
CREATE TYPE "StatutPaiement" AS ENUM ('PAID', 'PENDING', 'PARTIAL', 'FAILED');
CREATE TYPE "TypeOrgUnit" AS ENUM ('ORGANIZATION', 'REGION', 'DEPARTMENT', 'ARRONDISSEMENT');

-- CreateTable: ministeres
CREATE TABLE "ministeres" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "nom_fr" VARCHAR(200) NOT NULL,
    "nom_en" VARCHAR(200),
    "short_name" VARCHAR(30),
    "icon" VARCHAR(50),
    "couleur" VARCHAR(20),
    "est_actif" BOOLEAN NOT NULL DEFAULT true,
    "sort_index" INTEGER NOT NULL DEFAULT 0,
    "synchronise_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ministeres_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ministeres_code_key" ON "ministeres"("code");

-- CreateTable: domaines
CREATE TABLE "domaines" (
    "id" TEXT NOT NULL,
    "nom_fr" VARCHAR(200) NOT NULL,
    "nom_en" VARCHAR(200),
    "icon" VARCHAR(50),
    "couleur" VARCHAR(20),
    "est_actif" BOOLEAN NOT NULL DEFAULT true,
    "synchronise_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "domaines_pkey" PRIMARY KEY ("id")
);

-- CreateTable: org_units
CREATE TABLE "org_units" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "nom_fr" VARCHAR(200) NOT NULL,
    "nom_en" VARCHAR(200),
    "type" "TypeOrgUnit" NOT NULL DEFAULT 'ORGANIZATION',
    "parent_id" TEXT,
    "path" VARCHAR(500),
    "depth" INTEGER NOT NULL DEFAULT 0,
    "ministere_id" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "est_actif" BOOLEAN NOT NULL DEFAULT true,
    "synchronise_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "org_units_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "org_units_code_key" ON "org_units"("code");
CREATE INDEX "org_units_parent_id_idx" ON "org_units"("parent_id");
CREATE INDEX "org_units_type_idx" ON "org_units"("type");
CREATE INDEX "org_units_ministere_id_idx" ON "org_units"("ministere_id");

-- CreateTable: services_gouv
CREATE TABLE "services_gouv" (
    "id" TEXT NOT NULL,
    "nom_fr" VARCHAR(300) NOT NULL,
    "nom_en" VARCHAR(300),
    "montant" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ministere_id" TEXT,
    "domaine_id" TEXT,
    "org_unit_id" TEXT,
    "est_actif" BOOLEAN NOT NULL DEFAULT true,
    "synchronise_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "services_gouv_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "services_gouv_ministere_id_idx" ON "services_gouv"("ministere_id");
CREATE INDEX "services_gouv_domaine_id_idx" ON "services_gouv"("domaine_id");

-- CreateTable: roles
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "libelle" VARCHAR(120) NOT NULL,
    "niveau" "Niveau" NOT NULL,
    "description" TEXT,
    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateTable: utilisateurs
CREATE TABLE "utilisateurs" (
    "id" SERIAL NOT NULL,
    "identifiant" VARCHAR(60) NOT NULL,
    "mot_de_passe_hash" VARCHAR(255) NOT NULL,
    "nom_complet" VARCHAR(120) NOT NULL,
    "email" VARCHAR(120),
    "telephone" VARCHAR(30),
    "photo_url" VARCHAR(500),
    "sexe" VARCHAR(1),
    "email_verifie" BOOLEAN NOT NULL DEFAULT false,
    "code_verif_email" VARCHAR(6),
    "code_verif_expire" TIMESTAMPTZ,
    "rapport_quotidien" BOOLEAN NOT NULL DEFAULT false,
    "heure_rapport" VARCHAR(5),
    "niveau" "Niveau" NOT NULL,
    "est_super_admin" BOOLEAN NOT NULL DEFAULT false,
    "est_actif" BOOLEAN NOT NULL DEFAULT true,
    "ministere_id" TEXT,
    "org_unit_id" TEXT,
    "cree_par" INTEGER,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "utilisateurs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "utilisateurs_identifiant_key" ON "utilisateurs"("identifiant");

-- CreateTable: utilisateur_roles
CREATE TABLE "utilisateur_roles" (
    "utilisateur_id" INTEGER NOT NULL,
    "role_id" INTEGER NOT NULL,
    CONSTRAINT "utilisateur_roles_pkey" PRIMARY KEY ("utilisateur_id","role_id")
);

-- CreateTable: jetons_refresh
CREATE TABLE "jetons_refresh" (
    "id" SERIAL NOT NULL,
    "utilisateur_id" INTEGER NOT NULL,
    "jeton" VARCHAR(255) NOT NULL,
    "expire_le" TIMESTAMPTZ NOT NULL,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "jetons_refresh_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "jetons_refresh_jeton_key" ON "jetons_refresh"("jeton");

-- CreateTable: soumissions
CREATE TABLE "soumissions" (
    "id" SERIAL NOT NULL,
    "external_id" VARCHAR(60),
    "unique_code" VARCHAR(30),
    "formulaire_id" VARCHAR(60),
    "formulaire_nom" VARCHAR(300),
    "service_id" TEXT,
    "ministere_id" TEXT,
    "domaine_id" TEXT,
    "org_unit_id" TEXT,
    "soumetteur_nom" VARCHAR(200),
    "soumetteur_email" VARCHAR(200),
    "soumetteur_telephone" VARCHAR(30),
    "montant" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "statut_paiement" "StatutPaiement" NOT NULL DEFAULT 'PENDING',
    "date_soumission" TIMESTAMPTZ,
    "date_paiement" TIMESTAMPTZ,
    "donnees_formulaire" JSONB,
    "synchronise_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "soumissions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "soumissions_external_id_key" ON "soumissions"("external_id");
CREATE INDEX "soumissions_statut_paiement_idx" ON "soumissions"("statut_paiement");
CREATE INDEX "soumissions_service_id_idx" ON "soumissions"("service_id");
CREATE INDEX "soumissions_ministere_id_idx" ON "soumissions"("ministere_id");
CREATE INDEX "soumissions_domaine_id_idx" ON "soumissions"("domaine_id");
CREATE INDEX "soumissions_org_unit_id_idx" ON "soumissions"("org_unit_id");
CREATE INDEX "soumissions_date_soumission_idx" ON "soumissions"("date_soumission");
CREATE INDEX "soumissions_date_paiement_idx" ON "soumissions"("date_paiement");

-- CreateTable: cache_kpi
CREATE TABLE "cache_kpi" (
    "id" SERIAL NOT NULL,
    "date_debut" DATE,
    "date_fin" DATE,
    "total_revenus" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_soumissions" INTEGER NOT NULL DEFAULT 0,
    "soumissions_payees" INTEGER NOT NULL DEFAULT 0,
    "soumissions_en_attente" INTEGER NOT NULL DEFAULT 0,
    "soumissions_partielles" INTEGER NOT NULL DEFAULT 0,
    "soumissions_echouees" INTEGER NOT NULL DEFAULT 0,
    "taux_paiement" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "progression_mois_precedent" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "synchronise_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cache_kpi_pkey" PRIMARY KEY ("id")
);

-- CreateTable: cache_evolution
CREATE TABLE "cache_evolution" (
    "id" SERIAL NOT NULL,
    "periode" VARCHAR(30),
    "paye" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "en_attente" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "echoue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "date_debut" DATE,
    "date_fin" DATE,
    "synchronise_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cache_evolution_pkey" PRIMARY KEY ("id")
);

-- CreateTable: cache_repartition_ministeres
CREATE TABLE "cache_repartition_ministeres" (
    "id" SERIAL NOT NULL,
    "ministere_id" VARCHAR(60),
    "nom" VARCHAR(200),
    "montant" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "nombre_soumissions" INTEGER NOT NULL DEFAULT 0,
    "taux_paiement" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "couleur" VARCHAR(20),
    "date_debut" DATE,
    "date_fin" DATE,
    "synchronise_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cache_repartition_ministeres_pkey" PRIMARY KEY ("id")
);

-- CreateTable: cache_repartition_services
CREATE TABLE "cache_repartition_services" (
    "id" SERIAL NOT NULL,
    "service_id" VARCHAR(60),
    "nom" VARCHAR(300),
    "ministere_nom" VARCHAR(200),
    "montant" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "nombre_soumissions" INTEGER NOT NULL DEFAULT 0,
    "couleur" VARCHAR(20),
    "date_debut" DATE,
    "date_fin" DATE,
    "synchronise_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cache_repartition_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable: cache_repartition_domaines
CREATE TABLE "cache_repartition_domaines" (
    "id" SERIAL NOT NULL,
    "domaine_id" VARCHAR(60),
    "nom" VARCHAR(200),
    "montant" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "nombre_soumissions" INTEGER NOT NULL DEFAULT 0,
    "couleur" VARCHAR(20),
    "date_debut" DATE,
    "date_fin" DATE,
    "synchronise_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cache_repartition_domaines_pkey" PRIMARY KEY ("id")
);

-- CreateTable: cache_repartition_regions
CREATE TABLE "cache_repartition_regions" (
    "id" SERIAL NOT NULL,
    "org_unit_id" VARCHAR(60),
    "nom" VARCHAR(200),
    "valeur" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "objectif" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "statut" VARCHAR(20),
    "nombre_soumissions" INTEGER NOT NULL DEFAULT 0,
    "date_debut" DATE,
    "date_fin" DATE,
    "synchronise_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cache_repartition_regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: journal_sync
CREATE TABLE "journal_sync" (
    "id" SERIAL NOT NULL,
    "endpoint" VARCHAR(120) NOT NULL,
    "statut" "StatutSync" NOT NULL,
    "nb_enregistrements" INTEGER NOT NULL DEFAULT 0,
    "message_erreur" TEXT,
    "duree_ms" INTEGER,
    "execute_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "journal_sync_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "journal_sync_execute_le_idx" ON "journal_sync"("execute_le");

-- AddForeignKey
ALTER TABLE "org_units" ADD CONSTRAINT "org_units_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "org_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "org_units" ADD CONSTRAINT "org_units_ministere_id_fkey" FOREIGN KEY ("ministere_id") REFERENCES "ministeres"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "services_gouv" ADD CONSTRAINT "services_gouv_ministere_id_fkey" FOREIGN KEY ("ministere_id") REFERENCES "ministeres"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "services_gouv" ADD CONSTRAINT "services_gouv_domaine_id_fkey" FOREIGN KEY ("domaine_id") REFERENCES "domaines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "services_gouv" ADD CONSTRAINT "services_gouv_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "org_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "utilisateurs" ADD CONSTRAINT "utilisateurs_ministere_id_fkey" FOREIGN KEY ("ministere_id") REFERENCES "ministeres"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "utilisateurs" ADD CONSTRAINT "utilisateurs_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "org_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "utilisateurs" ADD CONSTRAINT "utilisateurs_cree_par_fkey" FOREIGN KEY ("cree_par") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "utilisateur_roles" ADD CONSTRAINT "utilisateur_roles_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "utilisateur_roles" ADD CONSTRAINT "utilisateur_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "jetons_refresh" ADD CONSTRAINT "jetons_refresh_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "soumissions" ADD CONSTRAINT "soumissions_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services_gouv"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "soumissions" ADD CONSTRAINT "soumissions_ministere_id_fkey" FOREIGN KEY ("ministere_id") REFERENCES "ministeres"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "soumissions" ADD CONSTRAINT "soumissions_domaine_id_fkey" FOREIGN KEY ("domaine_id") REFERENCES "domaines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "soumissions" ADD CONSTRAINT "soumissions_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "org_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
