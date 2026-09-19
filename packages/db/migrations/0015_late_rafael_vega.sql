ALTER TABLE "profilo" ADD COLUMN "condizioni" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "profilo" ADD COLUMN "regole_spente" jsonb DEFAULT '[]'::jsonb NOT NULL;