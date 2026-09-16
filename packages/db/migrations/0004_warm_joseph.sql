CREATE TABLE "alimenti" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"gruppo" text NOT NULL,
	"ruoli" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fasce" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"quantita" integer NOT NULL,
	"unita" text NOT NULL,
	"etichette" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "piani_pasti" ADD COLUMN "componenti" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "profilo" ADD COLUMN "esclusioni" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "profilo" ADD COLUMN "impostazione" text DEFAULT 'equilibrata' NOT NULL;--> statement-breakpoint
ALTER TABLE "profilo" ADD COLUMN "alimenti_scelti" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "alimenti_nome_idx" ON "alimenti" USING btree ("nome");