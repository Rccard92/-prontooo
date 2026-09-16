CREATE TABLE "allergeni" (
	"id" serial PRIMARY KEY NOT NULL,
	"codice" text NOT NULL,
	"nome" text NOT NULL,
	"note" text,
	"creato_il" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "battiti" (
	"id" serial PRIMARY KEY NOT NULL,
	"servizio" text NOT NULL,
	"messaggio" text NOT NULL,
	"registrato_il" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "allergeni_codice_idx" ON "allergeni" USING btree ("codice");