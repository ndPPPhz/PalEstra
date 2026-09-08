CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"user_agent" text,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"public_name" text,
	"bio" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coaching_relationships" (
	"id" uuid PRIMARY KEY NOT NULL,
	"coach_user_id" uuid NOT NULL,
	"athlete_user_id" uuid NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_user_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedbacks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"slot_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"raw_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"coach_user_id" uuid NOT NULL,
	"label" text NOT NULL,
	"accepted_by_user_id" uuid,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meso_days" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mesocycle_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meso_slots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"day_id" uuid NOT NULL,
	"exercise_id" uuid,
	"label_override" text,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meso_weeks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mesocycle_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"label" text NOT NULL,
	"published_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mesocycles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"relationship_id" uuid NOT NULL,
	"coach_user_id" uuid NOT NULL,
	"athlete_user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"completed_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prescriptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"week_id" uuid NOT NULL,
	"slot_id" uuid NOT NULL,
	"raw_text" text NOT NULL,
	"parsed" jsonb,
	"sets" integer,
	"reps" integer,
	"load_kg" numeric(6, 2),
	"coach_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"week_id" uuid NOT NULL,
	"day_id" uuid NOT NULL,
	"note" text,
	"performed_on" date,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"handle" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_profiles" ADD CONSTRAINT "coach_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_relationships" ADD CONSTRAINT "coaching_relationships_coach_user_id_users_id_fk" FOREIGN KEY ("coach_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_relationships" ADD CONSTRAINT "coaching_relationships_athlete_user_id_users_id_fk" FOREIGN KEY ("athlete_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_session_id_training_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."training_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_slot_id_meso_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."meso_slots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_coach_user_id_users_id_fk" FOREIGN KEY ("coach_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meso_days" ADD CONSTRAINT "meso_days_mesocycle_id_mesocycles_id_fk" FOREIGN KEY ("mesocycle_id") REFERENCES "public"."mesocycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meso_slots" ADD CONSTRAINT "meso_slots_day_id_meso_days_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."meso_days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meso_slots" ADD CONSTRAINT "meso_slots_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meso_weeks" ADD CONSTRAINT "meso_weeks_mesocycle_id_mesocycles_id_fk" FOREIGN KEY ("mesocycle_id") REFERENCES "public"."mesocycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mesocycles" ADD CONSTRAINT "mesocycles_relationship_id_coaching_relationships_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."coaching_relationships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mesocycles" ADD CONSTRAINT "mesocycles_coach_user_id_users_id_fk" FOREIGN KEY ("coach_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mesocycles" ADD CONSTRAINT "mesocycles_athlete_user_id_users_id_fk" FOREIGN KEY ("athlete_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_week_id_meso_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."meso_weeks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_slot_id_meso_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."meso_slots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_week_id_meso_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."meso_weeks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_day_id_meso_days_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."meso_days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_sessions_token_key" ON "auth_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "auth_sessions_user_idx" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coaching_rel_active_key" ON "coaching_relationships" USING btree ("coach_user_id","athlete_user_id") WHERE "coaching_relationships"."ended_at" is null;--> statement-breakpoint
CREATE INDEX "coaching_rel_coach_idx" ON "coaching_relationships" USING btree ("coach_user_id");--> statement-breakpoint
CREATE INDEX "coaching_rel_athlete_idx" ON "coaching_relationships" USING btree ("athlete_user_id");--> statement-breakpoint
CREATE INDEX "exercises_owner_idx" ON "exercises" USING btree ("owner_user_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "feedbacks_session_slot_key" ON "feedbacks" USING btree ("session_id","slot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invites_code_key" ON "invites" USING btree ("code");--> statement-breakpoint
CREATE INDEX "invites_coach_idx" ON "invites" USING btree ("coach_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "meso_days_position_key" ON "meso_days" USING btree ("mesocycle_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "meso_slots_position_key" ON "meso_slots" USING btree ("day_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "meso_weeks_position_key" ON "meso_weeks" USING btree ("mesocycle_id","position");--> statement-breakpoint
CREATE INDEX "mesocycles_coach_idx" ON "mesocycles" USING btree ("coach_user_id","created_at");--> statement-breakpoint
CREATE INDEX "mesocycles_athlete_idx" ON "mesocycles" USING btree ("athlete_user_id","created_at");--> statement-breakpoint
CREATE INDEX "otp_codes_email_idx" ON "otp_codes" USING btree ("email","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "prescriptions_week_slot_key" ON "prescriptions" USING btree ("week_id","slot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "training_sessions_week_day_key" ON "training_sessions" USING btree ("week_id","day_id");--> statement-breakpoint
CREATE INDEX "training_sessions_week_idx" ON "training_sessions" USING btree ("week_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_handle_key" ON "users" USING btree ("handle");