CREATE TABLE "iscrizioni_push" (
	"id" serial PRIMARY KEY NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"creata_il" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promemoria_mandati" (
	"id" serial PRIMARY KEY NOT NULL,
	"genere" text NOT NULL,
	"data" date NOT NULL,
	"mandato_il" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "iscrizioni_push_endpoint_idx" ON "iscrizioni_push" USING btree ("endpoint");--> statement-breakpoint
CREATE UNIQUE INDEX "promemoria_genere_data_idx" ON "promemoria_mandati" USING btree ("genere","data");