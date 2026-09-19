ALTER TABLE "ricetta_ingredienti" ADD COLUMN "alimento_id" integer;--> statement-breakpoint
ALTER TABLE "ricetta_ingredienti" ADD COLUMN "grammi" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "ricette" ADD COLUMN "posti" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "ricette" ADD COLUMN "etichette" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "ricetta_ingredienti" ADD CONSTRAINT "ricetta_ingredienti_alimento_id_alimenti_id_fk" FOREIGN KEY ("alimento_id") REFERENCES "public"."alimenti"("id") ON DELETE set null ON UPDATE no action;