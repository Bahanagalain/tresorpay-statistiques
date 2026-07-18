-- AlterTable: ajouter montant_paye à Soumission si absent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Soumission' AND column_name = 'montant_paye'
  ) THEN
    ALTER TABLE "Soumission" ADD COLUMN "montant_paye" DECIMAL(18,2) NOT NULL DEFAULT 0;
  END IF;
END $$;
