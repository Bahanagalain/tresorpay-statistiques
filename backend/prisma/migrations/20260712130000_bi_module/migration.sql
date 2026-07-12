-- Module BI Self-Service

-- Enums
CREATE TYPE "TypeWidget" AS ENUM ('CHART_BAR', 'CHART_LINE', 'CHART_PIE', 'CHART_AREA', 'CHART_DONUT', 'CHART_STACKED', 'KPI_CARD', 'TABLE', 'GAUGE', 'MAP', 'PIVOT');
CREATE TYPE "VisibiliteDashboard" AS ENUM ('PRIVE', 'EQUIPE', 'PUBLIC');
CREATE TYPE "TypeMesure" AS ENUM ('COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'RATIO', 'CUSTOM');
CREATE TYPE "GranulariteTemporelle" AS ENUM ('JOUR', 'SEMAINE', 'MOIS', 'TRIMESTRE', 'ANNEE');

-- Datasets
CREATE TABLE "bi_datasets" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "libelle" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "table_source" VARCHAR(60) NOT NULL,
    "joins_config" JSONB,
    "colonnes_disponibles" JSONB,
    "est_actif" BOOLEAN NOT NULL DEFAULT true,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bi_datasets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "bi_datasets_code_key" ON "bi_datasets"("code");

-- Indicateurs
CREATE TABLE "bi_indicateurs" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "libelle" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "dataset_id" INTEGER NOT NULL,
    "type_mesure" "TypeMesure" NOT NULL,
    "formule" JSONB,
    "colonne_mesure" VARCHAR(100),
    "filtres_defaut" JSONB,
    "format_affichage" VARCHAR(30),
    "createur_id" INTEGER NOT NULL,
    "est_systeme" BOOLEAN NOT NULL DEFAULT false,
    "est_actif" BOOLEAN NOT NULL DEFAULT true,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bi_indicateurs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bi_indicateurs_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "bi_datasets"("id") ON DELETE RESTRICT,
    CONSTRAINT "bi_indicateurs_createur_id_fkey" FOREIGN KEY ("createur_id") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "bi_indicateurs_code_key" ON "bi_indicateurs"("code");
CREATE INDEX "bi_indicateurs_dataset_id_idx" ON "bi_indicateurs"("dataset_id");
CREATE INDEX "bi_indicateurs_createur_id_idx" ON "bi_indicateurs"("createur_id");

-- Dashboards
CREATE TABLE "bi_dashboards" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(60) NOT NULL DEFAULT gen_random_uuid(),
    "titre" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "visibilite" "VisibiliteDashboard" NOT NULL DEFAULT 'PRIVE',
    "layout_config" JSONB,
    "filtres_globaux" JSONB,
    "theme_config" JSONB,
    "proprietaire_id" INTEGER NOT NULL,
    "est_favori" BOOLEAN NOT NULL DEFAULT false,
    "ordre_affichage" INTEGER NOT NULL DEFAULT 0,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bi_dashboards_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bi_dashboards_proprietaire_id_fkey" FOREIGN KEY ("proprietaire_id") REFERENCES "utilisateurs"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "bi_dashboards_code_key" ON "bi_dashboards"("code");
CREATE INDEX "bi_dashboards_proprietaire_id_idx" ON "bi_dashboards"("proprietaire_id");
CREATE INDEX "bi_dashboards_visibilite_idx" ON "bi_dashboards"("visibilite");

-- Partages
CREATE TABLE "bi_dashboard_partages" (
    "id" SERIAL NOT NULL,
    "dashboard_id" INTEGER NOT NULL,
    "utilisateur_id" INTEGER,
    "niveau_partage" "Niveau",
    "ministere_id" VARCHAR(60),
    "peut_editer" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "bi_dashboard_partages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bi_dashboard_partages_dashboard_id_fkey" FOREIGN KEY ("dashboard_id") REFERENCES "bi_dashboards"("id") ON DELETE CASCADE,
    CONSTRAINT "bi_dashboard_partages_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "bi_dashboard_partages_dashboard_id_utilisateur_id_key" ON "bi_dashboard_partages"("dashboard_id", "utilisateur_id");
CREATE INDEX "bi_dashboard_partages_utilisateur_id_idx" ON "bi_dashboard_partages"("utilisateur_id");

-- Filtres globaux
CREATE TABLE "bi_filtres_globaux" (
    "id" SERIAL NOT NULL,
    "dashboard_id" INTEGER NOT NULL,
    "cle" VARCHAR(60) NOT NULL,
    "libelle" VARCHAR(120) NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "config" JSONB,
    "ordre_affichage" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "bi_filtres_globaux_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bi_filtres_globaux_dashboard_id_fkey" FOREIGN KEY ("dashboard_id") REFERENCES "bi_dashboards"("id") ON DELETE CASCADE
);
CREATE INDEX "bi_filtres_globaux_dashboard_id_idx" ON "bi_filtres_globaux"("dashboard_id");

-- Widgets
CREATE TABLE "bi_widgets" (
    "id" SERIAL NOT NULL,
    "dashboard_id" INTEGER NOT NULL,
    "dataset_id" INTEGER,
    "titre" VARCHAR(200) NOT NULL,
    "type_widget" "TypeWidget" NOT NULL,
    "dimensions" JSONB,
    "filtres_locaux" JSONB,
    "granularite" "GranulariteTemporelle",
    "limite" INTEGER NOT NULL DEFAULT 20,
    "tri" VARCHAR(4) NOT NULL DEFAULT 'desc',
    "chart_config" JSONB,
    "grid_x" INTEGER NOT NULL DEFAULT 0,
    "grid_y" INTEGER NOT NULL DEFAULT 0,
    "grid_w" INTEGER NOT NULL DEFAULT 6,
    "grid_h" INTEGER NOT NULL DEFAULT 4,
    "drill_down_config" JSONB,
    "ordre_affichage" INTEGER NOT NULL DEFAULT 0,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bi_widgets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bi_widgets_dashboard_id_fkey" FOREIGN KEY ("dashboard_id") REFERENCES "bi_dashboards"("id") ON DELETE CASCADE,
    CONSTRAINT "bi_widgets_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "bi_datasets"("id") ON DELETE SET NULL
);
CREATE INDEX "bi_widgets_dashboard_id_idx" ON "bi_widgets"("dashboard_id");
CREATE INDEX "bi_widgets_dataset_id_idx" ON "bi_widgets"("dataset_id");

-- Widget ↔ Indicateur
CREATE TABLE "bi_widget_indicateurs" (
    "id" SERIAL NOT NULL,
    "widget_id" INTEGER NOT NULL,
    "indicateur_id" INTEGER NOT NULL,
    "ordre_affichage" INTEGER NOT NULL DEFAULT 0,
    "couleur" VARCHAR(20),
    CONSTRAINT "bi_widget_indicateurs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bi_widget_indicateurs_widget_id_fkey" FOREIGN KEY ("widget_id") REFERENCES "bi_widgets"("id") ON DELETE CASCADE,
    CONSTRAINT "bi_widget_indicateurs_indicateur_id_fkey" FOREIGN KEY ("indicateur_id") REFERENCES "bi_indicateurs"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "bi_widget_indicateurs_widget_id_indicateur_id_key" ON "bi_widget_indicateurs"("widget_id", "indicateur_id");

-- Seed datasets initiaux
INSERT INTO "bi_datasets" ("code", "libelle", "description", "table_source", "colonnes_disponibles") VALUES
('soumissions', 'Soumissions citoyens', 'Formulaires soumis par les citoyens avec données de paiement', 'soumissions', '{"dimensions":["ministere","service","domaine","region","departement","structure","statut","mois","trimestre","annee"],"mesures":["montant","montant_paye"],"filtres":["date_soumission","statut_paiement","ministere_id","service_id","domaine_id","org_unit_id"]}'),
('demandes_partenaire', 'Demandes partenaires', 'Paiements via plateformes partenaires (API)', 'demandes_partenaire', '{"dimensions":["plateforme","service","statut","methode_paiement","operateur","mois"],"mesures":["montant","montant_paye"],"filtres":["date_creation","statut","plateforme_id","methode_paiement"]}'),
('audit', 'Journal d''audit', 'Actions effectuées par les administrateurs', 'journal_audit', '{"dimensions":["acteur","action","type_entite","mois"],"mesures":[],"filtres":["date_execution","action","type_entite"]}');
