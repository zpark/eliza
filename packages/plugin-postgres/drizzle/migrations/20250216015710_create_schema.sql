CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"createdAt" timestamptz DEFAULT now() NOT NULL,
	"name" text,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"avatarUrl" text,
	"details" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "cache" (
	"key" text NOT NULL,
	"agentId" text NOT NULL,
	"value" jsonb DEFAULT '{}'::jsonb,
	"createdAt" timestamptz DEFAULT now() NOT NULL,
	"expiresAt" timestamptz,
	CONSTRAINT "cache_key_agent_unique" UNIQUE("key","agentId")
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"name" text PRIMARY KEY NOT NULL,
	"username" text,
	"email" text,
	"system" text,
	"templates" jsonb DEFAULT '{}'::jsonb,
	"bio" jsonb NOT NULL,
	"message_examples" jsonb DEFAULT '[]'::jsonb,
	"post_examples" jsonb DEFAULT '[]'::jsonb,
	"topics" jsonb DEFAULT '[]'::jsonb,
	"adjectives" jsonb DEFAULT '[]'::jsonb,
	"knowledge" jsonb DEFAULT '[]'::jsonb,
	"plugins" jsonb DEFAULT '[]'::jsonb,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"style" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamptz DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"memory_id" uuid,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"dim_384" vector(384),
	"dim_512" vector(512),
	"dim_768" vector(768),
	"dim_1024" vector(1024),
	"dim_1536" vector(1536),
	"dim_3072" vector(3072),
	CONSTRAINT "embedding_source_check" CHECK ("memory_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid NOT NULL,
	"createdAt" timestamptz DEFAULT now() NOT NULL,
	"userId" uuid,
	"name" text,
	"status" text,
	"description" text,
	"roomId" uuid,
	"objectives" jsonb DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "logs" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"createdAt" timestamptz DEFAULT now() NOT NULL,
	"userId" uuid NOT NULL,
	"body" jsonb NOT NULL,
	"type" text NOT NULL,
	"roomId" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"createdAt" timestamptz DEFAULT now() NOT NULL,
	"content" jsonb NOT NULL,
	"userId" uuid,
	"agentId" uuid,
	"roomId" uuid,
	"unique" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" uuid NOT NULL,
	"createdAt" timestamptz DEFAULT now() NOT NULL,
	"userId" uuid,
	"roomId" uuid,
	"userState" text,
	"last_message_read" text,
	CONSTRAINT "participants_user_room_unique" UNIQUE("userId","roomId")
);
--> statement-breakpoint
CREATE TABLE "relationships" (
	"id" uuid NOT NULL,
	"createdAt" timestamptz DEFAULT now() NOT NULL,
	"userA" uuid NOT NULL,
	"userB" uuid NOT NULL,
	"status" text,
	"userId" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY NOT NULL,
	"createdAt" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_memory_id_memories_id_fk" FOREIGN KEY ("memory_id") REFERENCES "public"."memories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "embeddings" ADD CONSTRAINT "fk_embedding_memory" FOREIGN KEY ("memory_id") REFERENCES "public"."memories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_userId_accounts_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_roomId_rooms_id_fk" FOREIGN KEY ("roomId") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "fk_room" FOREIGN KEY ("roomId") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "fk_user" FOREIGN KEY ("userId") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logs" ADD CONSTRAINT "logs_userId_accounts_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logs" ADD CONSTRAINT "logs_roomId_rooms_id_fk" FOREIGN KEY ("roomId") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logs" ADD CONSTRAINT "fk_room" FOREIGN KEY ("roomId") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logs" ADD CONSTRAINT "fk_user" FOREIGN KEY ("userId") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_userId_accounts_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_agentId_accounts_id_fk" FOREIGN KEY ("agentId") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_roomId_rooms_id_fk" FOREIGN KEY ("roomId") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "fk_room" FOREIGN KEY ("roomId") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "fk_user" FOREIGN KEY ("userId") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "fk_agent" FOREIGN KEY ("agentId") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_userId_accounts_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_roomId_rooms_id_fk" FOREIGN KEY ("roomId") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "fk_room" FOREIGN KEY ("roomId") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "fk_user" FOREIGN KEY ("userId") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_userA_accounts_id_fk" FOREIGN KEY ("userA") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_userB_accounts_id_fk" FOREIGN KEY ("userB") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_userId_accounts_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "fk_user_a" FOREIGN KEY ("userA") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "fk_user_b" FOREIGN KEY ("userB") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "fk_user" FOREIGN KEY ("userId") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_embedding_memory" ON "embeddings" USING btree ("memory_id");--> statement-breakpoint
CREATE INDEX "idx_memories_type_room" ON "memories" USING btree ("type","roomId");--> statement-breakpoint
CREATE INDEX "idx_participants_user" ON "participants" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_participants_room" ON "participants" USING btree ("roomId");--> statement-breakpoint
CREATE INDEX "idx_relationships_users" ON "relationships" USING btree ("userA","userB");