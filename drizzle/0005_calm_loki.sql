CREATE TABLE "admin_sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp (6) NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_admin_sessions_expire" ON "admin_sessions" USING btree ("expire");