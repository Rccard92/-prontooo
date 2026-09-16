CREATE TABLE "piani" (
	"id" serial PRIMARY KEY NOT NULL,
	"inizio_settimana" date NOT NULL,
	"creato_il" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "piani_pasti" (
	"id" serial PRIMARY KEY NOT NULL,
	"piano_id" integer NOT NULL,
	"giorno" integer NOT NULL,
	"fascia" text NOT NULL,
	"ricetta_id" integer,
	"porzioni" integer DEFAULT 2 NOT NULL,
	"bloccato" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profilo" (
	"id" integer PRIMARY KEY NOT NULL,
	"adulti" integer DEFAULT 2 NOT NULL,
	"bambini" integer DEFAULT 0 NOT NULL,
	"porzioni_default" integer DEFAULT 2 NOT NULL,
	"fasce_attive" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"giorni_fuori_pranzo" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"minuti_massimi" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"da_evitare" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"settimane_anti_ripetizione" integer DEFAULT 3 NOT NULL,
	"aggiornato_il" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ricette" ADD COLUMN "categoria_fonte" text;--> statement-breakpoint
ALTER TABLE "ricette" ADD COLUMN "ruolo" text;--> statement-breakpoint
ALTER TABLE "ricette" ADD COLUMN "fasce" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "piani_pasti" ADD CONSTRAINT "piani_pasti_piano_id_piani_id_fk" FOREIGN KEY ("piano_id") REFERENCES "public"."piani"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piani_pasti" ADD CONSTRAINT "piani_pasti_ricetta_id_ricette_id_fk" FOREIGN KEY ("ricetta_id") REFERENCES "public"."ricette"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "piani_inizio_settimana_idx" ON "piani" USING btree ("inizio_settimana");--> statement-breakpoint
CREATE UNIQUE INDEX "piani_pasti_posto_idx" ON "piani_pasti" USING btree ("piano_id","giorno","fascia");