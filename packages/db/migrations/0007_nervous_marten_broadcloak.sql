CREATE TABLE "offerte" (
	"id" serial PRIMARY KEY NOT NULL,
	"volantino_id" integer NOT NULL,
	"riga_grezza" text NOT NULL,
	"nome_grezzo" text NOT NULL,
	"marca" text,
	"formato" text,
	"prezzo" numeric(8, 2) NOT NULL,
	"prezzo_unitario" numeric(8, 2),
	"unita_prezzo" text,
	"alimento_id" integer,
	"confidenza" numeric(3, 2) DEFAULT '0' NOT NULL,
	"confermato" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "volantini" (
	"id" serial PRIMARY KEY NOT NULL,
	"insegna" text NOT NULL,
	"punto_vendita" text,
	"valido_dal" date,
	"valido_al" date,
	"nome_file" text,
	"caricato_il" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "offerte" ADD CONSTRAINT "offerte_volantino_id_volantini_id_fk" FOREIGN KEY ("volantino_id") REFERENCES "public"."volantini"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offerte" ADD CONSTRAINT "offerte_alimento_id_alimenti_id_fk" FOREIGN KEY ("alimento_id") REFERENCES "public"."alimenti"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "offerte_volantino_idx" ON "offerte" USING btree ("volantino_id");--> statement-breakpoint
CREATE INDEX "offerte_alimento_idx" ON "offerte" USING btree ("alimento_id");--> statement-breakpoint
CREATE INDEX "volantini_validita_idx" ON "volantini" USING btree ("valido_al");