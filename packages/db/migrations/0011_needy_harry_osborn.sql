ALTER TABLE "giornata_pasti" DROP CONSTRAINT "giornata_pasti_ricetta_id_ricette_id_fk";
--> statement-breakpoint
ALTER TABLE "giornata_pasti" DROP COLUMN "ricetta_id";