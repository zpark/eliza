
CREATE TABLE "positions" (
	"id" text PRIMARY KEY NOT NULL,
	"isSimulation" boolean DEFAULT false,
	"walletAddress" text NOT NULL,
	"chain" text NOT NULL,
	"tokenAddress" text NOT NULL,
	"recommenderId" text NOT NULL,
	"recommendationId" text NOT NULL,
	"initialPrice" text NOT NULL,
	"initialMarketCap" text NOT NULL,
	"initialLiquidity" text NOT NULL,
	"performanceScore" real,
	"rapidDump" boolean DEFAULT false,
	"metadata" jsonb DEFAULT '{}',
	"openedAt" timestamp,
	"closedAt" timestamp,
	"updatedAt" timestamp
);

CREATE TABLE "recommender_metrics" (
	"recommenderId" text PRIMARY KEY NOT NULL,
	"trustScore" real,
	"totalRecommendations" integer,
	"successfulRecs" integer,
	"avgTokenPerformance" real,
	"riskScore" real,
	"consistencyScore" real,
	"virtualConfidence" real,
	"lastActiveDate" timestamp,
	"trustDecay" real,
	"updatedAt" timestamp
);

CREATE TABLE "recommender_metrics_history" (
	"historyId" text PRIMARY KEY NOT NULL,
	"recommenderId" text NOT NULL,
	"trustScore" real,
	"totalRecommendations" integer,
	"successfulRecs" integer,
	"avgTokenPerformance" real,
	"riskScore" real,
	"consistencyScore" real,
	"virtualConfidence" real DEFAULT 0,
	"recordedAt" timestamp DEFAULT now()
);

CREATE TABLE "recommenders" (
	"id" text PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"userId" uuid NOT NULL,
	"username" text NOT NULL
);

CREATE TABLE "token_performance" (
	"chain" text NOT NULL,
	"address" text NOT NULL,
	"name" text,
	"symbol" text,
	"decimals" integer,
	"metadata" jsonb DEFAULT '{}',
	"price" real DEFAULT 0,
	"price24hChange" real DEFAULT 0,
	"volume" real DEFAULT 0,
	"volume24hChange" real DEFAULT 0,
	"trades" real DEFAULT 0,
	"trades24hChange" real DEFAULT 0,
	"liquidity" real DEFAULT 0,
	"initialMarketCap" real DEFAULT 0,
	"currentMarketCap" real DEFAULT 0,
	"holders" real DEFAULT 0,
	"holders24hChange" real DEFAULT 0,
	"rugPull" boolean DEFAULT false,
	"isScam" boolean DEFAULT false,
	"sustainedGrowth" boolean DEFAULT false,
	"rapidDump" boolean DEFAULT false,
	"suspiciousVolume" boolean DEFAULT false,
	"validationTrust" real DEFAULT 0,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now(),
	CONSTRAINT "token_performance_chain_address_pk" PRIMARY KEY("chain","address")
);
--> statement-breakpoint
CREATE TABLE "token_recommendations" (
	"id" text PRIMARY KEY NOT NULL,
	"recommenderId" text NOT NULL,
	"chain" text NOT NULL,
	"address" text NOT NULL,
	"initialPrice" real NOT NULL,
	"price" real NOT NULL,
	"initialMarketCap" real NOT NULL,
	"marketCap" real NOT NULL,
	"initialLiquidity" real NOT NULL,
	"liquidity" real NOT NULL,
	"rugPull" boolean DEFAULT false,
	"isScam" boolean DEFAULT false,
	"riskScore" real DEFAULT 0,
	"performanceScore" real DEFAULT 0,
	"metadata" jsonb DEFAULT '{}',
	"status" text NOT NULL,
	"conviction" text NOT NULL,
	"tradeType" text NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"positionId" text,
	"type" text NOT NULL,
	"isSimulation" boolean DEFAULT false,
	"chain" text NOT NULL,
	"address" text NOT NULL,
	"transactionHash" text NOT NULL,
	"amount" bigint NOT NULL,
	"valueUsd" text,
	"price" text,
	"solAmount" bigint,
	"solValueUsd" text,
	"solPrice" text,
	"marketCap" text,
	"liquidity" text,
	"timestamp" timestamp DEFAULT now()
);

ALTER TABLE "positions" ADD CONSTRAINT "positions_recommenderId_recommenders_id_fk" FOREIGN KEY ("recommenderId") REFERENCES "public"."recommenders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_recommendationId_token_recommendations_id_fk" FOREIGN KEY ("recommendationId") REFERENCES "public"."token_recommendations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommender_metrics" ADD CONSTRAINT "recommender_metrics_recommenderId_recommenders_id_fk" FOREIGN KEY ("recommenderId") REFERENCES "public"."recommenders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommender_metrics_history" ADD CONSTRAINT "recommender_metrics_history_recommenderId_recommenders_id_fk" FOREIGN KEY ("recommenderId") REFERENCES "public"."recommenders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommenders" ADD CONSTRAINT "recommenders_userId_accounts_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_recommendations" ADD CONSTRAINT "token_recommendations_recommenderId_recommenders_id_fk" FOREIGN KEY ("recommenderId") REFERENCES "public"."recommenders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_positionId_positions_id_fk" FOREIGN KEY ("positionId") REFERENCES "public"."positions"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "recommenders" ADD CONSTRAINT "recommenders_userId_unique" UNIQUE("userId");
