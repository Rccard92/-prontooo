CREATE TABLE "ingrediente_allergene" (
	"ingrediente_id" integer NOT NULL,
	"allergene_id" integer NOT NULL,
	"certezza" text DEFAULT 'certo' NOT NULL,
	CONSTRAINT "ingrediente_allergene_ingrediente_id_allergene_id_pk" PRIMARY KEY("ingrediente_id","allergene_id")
);
--> statement-breakpoint
CREATE TABLE "ingredienti_canonici" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"categoria" text,
	"reparto" text,
	"mesi_stagione" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"creato_il" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ricetta_ingredienti" (
	"id" serial PRIMARY KEY NOT NULL,
	"ricetta_id" integer NOT NULL,
	"posizione" integer NOT NULL,
	"riga_grezza" text NOT NULL,
	"quantita" numeric(10, 3),
	"unita" text,
	"ingrediente_canonico_id" integer
);
--> statement-breakpoint
CREATE TABLE "ricette" (
	"id" serial PRIMARY KEY NOT NULL,
	"titolo" text NOT NULL,
	"fonte_url" text NOT NULL,
	"fonte_nome" text NOT NULL,
	"immagine_url" text,
	"descrizione" text,
	"minuti_preparazione" integer,
	"minuti_cottura" integer,
	"minuti_totali" integer,
	"porzioni" integer,
	"difficolta" text,
	"tipo_pasto" text,
	"passaggi" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"normalizzata_il" timestamp with time zone,
	"importata_il" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ingrediente_allergene" ADD CONSTRAINT "ingrediente_allergene_ingrediente_id_ingredienti_canonici_id_fk" FOREIGN KEY ("ingrediente_id") REFERENCES "public"."ingredienti_canonici"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingrediente_allergene" ADD CONSTRAINT "ingrediente_allergene_allergene_id_allergeni_id_fk" FOREIGN KEY ("allergene_id") REFERENCES "public"."allergeni"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ricetta_ingredienti" ADD CONSTRAINT "ricetta_ingredienti_ricetta_id_ricette_id_fk" FOREIGN KEY ("ricetta_id") REFERENCES "public"."ricette"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ricetta_ingredienti" ADD CONSTRAINT "ricetta_ingredienti_ingrediente_canonico_id_ingredienti_canonici_id_fk" FOREIGN KEY ("ingrediente_canonico_id") REFERENCES "public"."ingredienti_canonici"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ingredienti_canonici_nome_idx" ON "ingredienti_canonici" USING btree ("nome");--> statement-breakpoint
CREATE INDEX "ricetta_ingredienti_ricetta_idx" ON "ricetta_ingredienti" USING btree ("ricetta_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ricette_fonte_url_idx" ON "ricette" USING btree ("fonte_url");--> statement-breakpoint
CREATE INDEX "ricette_titolo_idx" ON "ricette" USING btree ("titolo");