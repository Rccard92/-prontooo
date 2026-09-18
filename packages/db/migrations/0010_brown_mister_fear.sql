CREATE TABLE "utenti" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"hash" text NOT NULL,
	"creato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"ultimo_accesso" timestamp with time zone
);
--> statement-breakpoint
DROP INDEX "dispensa_alimento_idx";--> statement-breakpoint
DROP INDEX "giornate_data_idx";--> statement-breakpoint
DROP INDEX "pesi_data_idx";--> statement-breakpoint
DROP INDEX "promemoria_genere_data_idx";--> statement-breakpoint
DROP INDEX "spesa_spuntati_settimana_idx";--> statement-breakpoint
ALTER TABLE "dispensa" ADD COLUMN "utente_id" integer;--> statement-breakpoint
ALTER TABLE "giornate" ADD COLUMN "utente_id" integer;--> statement-breakpoint
ALTER TABLE "iscrizioni_push" ADD COLUMN "utente_id" integer;--> statement-breakpoint
ALTER TABLE "liste" ADD COLUMN "utente_id" integer;--> statement-breakpoint
ALTER TABLE "pesi" ADD COLUMN "utente_id" integer;--> statement-breakpoint
ALTER TABLE "profilo" ADD COLUMN "utente_id" integer;--> statement-breakpoint
ALTER TABLE "promemoria_mandati" ADD COLUMN "utente_id" integer;--> statement-breakpoint
ALTER TABLE "spesa_spuntati" ADD COLUMN "utente_id" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "utenti_email_idx" ON "utenti" USING btree ("email");--> statement-breakpoint
ALTER TABLE "dispensa" ADD CONSTRAINT "dispensa_utente_id_utenti_id_fk" FOREIGN KEY ("utente_id") REFERENCES "public"."utenti"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "giornate" ADD CONSTRAINT "giornate_utente_id_utenti_id_fk" FOREIGN KEY ("utente_id") REFERENCES "public"."utenti"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iscrizioni_push" ADD CONSTRAINT "iscrizioni_push_utente_id_utenti_id_fk" FOREIGN KEY ("utente_id") REFERENCES "public"."utenti"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liste" ADD CONSTRAINT "liste_utente_id_utenti_id_fk" FOREIGN KEY ("utente_id") REFERENCES "public"."utenti"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pesi" ADD CONSTRAINT "pesi_utente_id_utenti_id_fk" FOREIGN KEY ("utente_id") REFERENCES "public"."utenti"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profilo" ADD CONSTRAINT "profilo_utente_id_utenti_id_fk" FOREIGN KEY ("utente_id") REFERENCES "public"."utenti"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promemoria_mandati" ADD CONSTRAINT "promemoria_mandati_utente_id_utenti_id_fk" FOREIGN KEY ("utente_id") REFERENCES "public"."utenti"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spesa_spuntati" ADD CONSTRAINT "spesa_spuntati_utente_id_utenti_id_fk" FOREIGN KEY ("utente_id") REFERENCES "public"."utenti"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dispensa_alimento_idx" ON "dispensa" USING btree ("utente_id","alimento_id");--> statement-breakpoint
CREATE UNIQUE INDEX "giornate_data_idx" ON "giornate" USING btree ("utente_id","data");--> statement-breakpoint
CREATE UNIQUE INDEX "pesi_data_idx" ON "pesi" USING btree ("utente_id","data");--> statement-breakpoint
CREATE UNIQUE INDEX "promemoria_genere_data_idx" ON "promemoria_mandati" USING btree ("utente_id","genere","data");--> statement-breakpoint
CREATE INDEX "spesa_spuntati_settimana_idx" ON "spesa_spuntati" USING btree ("utente_id","settimana");