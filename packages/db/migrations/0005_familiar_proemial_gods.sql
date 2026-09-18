CREATE TABLE "dispensa" (
	"id" serial PRIMARY KEY NOT NULL,
	"alimento_id" integer NOT NULL,
	"quantita" numeric(8, 2) NOT NULL,
	"unita" text DEFAULT 'g' NOT NULL,
	"aggiornato_il" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "giornata_pasti" (
	"id" serial PRIMARY KEY NOT NULL,
	"giornata_id" integer NOT NULL,
	"fascia" text NOT NULL,
	"stato" text DEFAULT 'previsto' NOT NULL,
	"bloccato" boolean DEFAULT false NOT NULL,
	"previsti" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"consumati" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ricetta_id" integer,
	"registrato_il" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "giornate" (
	"id" serial PRIMARY KEY NOT NULL,
	"data" date NOT NULL,
	"tipo_giorno" text DEFAULT 'standard' NOT NULL,
	"lista_id" integer,
	"obiettivo" jsonb DEFAULT '{"kcal":0,"proteine":0,"carboidrati":0,"grassi":0}'::jsonb NOT NULL,
	"creato_il" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lista_voci" (
	"id" serial PRIMARY KEY NOT NULL,
	"lista_id" integer NOT NULL,
	"giorno" text DEFAULT 'standard' NOT NULL,
	"fascia" text NOT NULL,
	"riga" integer NOT NULL,
	"ordine" integer DEFAULT 0 NOT NULL,
	"alimento_id" integer,
	"testo_grezzo" text,
	"quantita" numeric(8, 2) NOT NULL,
	"unita" text DEFAULT 'g' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "liste" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"origine" text DEFAULT 'manuale' NOT NULL,
	"data_visita" date,
	"attiva" boolean DEFAULT false NOT NULL,
	"creato_il" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pesi" (
	"id" serial PRIMARY KEY NOT NULL,
	"data" date NOT NULL,
	"kg" numeric(5, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spesa_spuntati" (
	"id" serial PRIMARY KEY NOT NULL,
	"settimana" date NOT NULL,
	"alimento_id" integer,
	"voce_libera" text,
	"spuntato" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alimenti" ADD COLUMN "kcal" numeric(7, 2);--> statement-breakpoint
ALTER TABLE "alimenti" ADD COLUMN "proteine" numeric(7, 2);--> statement-breakpoint
ALTER TABLE "alimenti" ADD COLUMN "carboidrati" numeric(7, 2);--> statement-breakpoint
ALTER TABLE "alimenti" ADD COLUMN "grassi" numeric(7, 2);--> statement-breakpoint
ALTER TABLE "alimenti" ADD COLUMN "fibre" numeric(7, 2);--> statement-breakpoint
ALTER TABLE "alimenti" ADD COLUMN "reparto" text;--> statement-breakpoint
ALTER TABLE "dispensa" ADD CONSTRAINT "dispensa_alimento_id_alimenti_id_fk" FOREIGN KEY ("alimento_id") REFERENCES "public"."alimenti"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "giornata_pasti" ADD CONSTRAINT "giornata_pasti_giornata_id_giornate_id_fk" FOREIGN KEY ("giornata_id") REFERENCES "public"."giornate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "giornata_pasti" ADD CONSTRAINT "giornata_pasti_ricetta_id_ricette_id_fk" FOREIGN KEY ("ricetta_id") REFERENCES "public"."ricette"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "giornate" ADD CONSTRAINT "giornate_lista_id_liste_id_fk" FOREIGN KEY ("lista_id") REFERENCES "public"."liste"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lista_voci" ADD CONSTRAINT "lista_voci_lista_id_liste_id_fk" FOREIGN KEY ("lista_id") REFERENCES "public"."liste"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lista_voci" ADD CONSTRAINT "lista_voci_alimento_id_alimenti_id_fk" FOREIGN KEY ("alimento_id") REFERENCES "public"."alimenti"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spesa_spuntati" ADD CONSTRAINT "spesa_spuntati_alimento_id_alimenti_id_fk" FOREIGN KEY ("alimento_id") REFERENCES "public"."alimenti"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dispensa_alimento_idx" ON "dispensa" USING btree ("alimento_id");--> statement-breakpoint
CREATE UNIQUE INDEX "giornata_pasti_posto_idx" ON "giornata_pasti" USING btree ("giornata_id","fascia");--> statement-breakpoint
CREATE UNIQUE INDEX "giornate_data_idx" ON "giornate" USING btree ("data");--> statement-breakpoint
CREATE INDEX "lista_voci_lista_idx" ON "lista_voci" USING btree ("lista_id","giorno","fascia");--> statement-breakpoint
CREATE UNIQUE INDEX "pesi_data_idx" ON "pesi" USING btree ("data");--> statement-breakpoint
CREATE INDEX "spesa_spuntati_settimana_idx" ON "spesa_spuntati" USING btree ("settimana");