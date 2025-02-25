import { PGlite } from "@electric-sql/pglite";
import type { PGliteOptions } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";
import { fuzzystrmatch } from "@electric-sql/pglite/contrib/fuzzystrmatch";
import { logger } from "@elizaos/core";
import type { IDatabaseClientManager } from "../types";
import { fileURLToPath } from 'node:url';
import path from "node:path";
import { drizzle } from "drizzle-orm/pglite";
import fs from 'node:fs/promises';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class PGliteClientManager implements IDatabaseClientManager<PGlite> {
    private client: PGlite;
    private shuttingDown = false;
    private readonly shutdownTimeout = 800;

    constructor(options: PGliteOptions) {
        this.client = new PGlite({
            ...options,
            extensions: {
                vector,
                fuzzystrmatch,
            },
        });
        this.setupShutdownHandlers();
    }

    public getConnection(): PGlite {
        if (this.shuttingDown) {
            throw new Error("Client manager is shutting down");
        }
        return this.client;
    }

    private async gracefulShutdown() {
        if (this.shuttingDown) {
            return;
        }

        this.shuttingDown = true;
        logger.info("Starting graceful shutdown of PGlite client...");
    
        const timeout = setTimeout(() => {
            logger.warn("Shutdown timeout reached, forcing database connection closure...");
            this.client.close().finally(() => {
                process.exit(1);
            });
        }, this.shutdownTimeout);

        try {
            await new Promise(resolve => setTimeout(resolve, this.shutdownTimeout));
            await this.client.close();
            clearTimeout(timeout);
            logger.info("PGlite client shutdown completed successfully");
            process.exit(0);
        } catch (error) {
            logger.error("Error during graceful shutdown:", error);
            process.exit(1);
        }
    }

    private setupShutdownHandlers() {
        process.on("SIGINT", async () => {
            await this.gracefulShutdown();
        });

        process.on("SIGTERM", async () => {
            await this.gracefulShutdown();
        });

        process.on("beforeExit", async () => {
            await this.gracefulShutdown();
        });
    }

    public async initialize(): Promise<void> {
        try {
            await this.client.waitReady;
            logger.info("PGlite client initialized successfully");
        } catch (error) {
            logger.error("Failed to initialize PGlite client:", error);
            throw error;
        }
    }

    public async close(): Promise<void> {
        if (!this.shuttingDown) {
            await this.gracefulShutdown();
        }
    }

    public isShuttingDown(): boolean {
        return this.shuttingDown;
    }

    private async ensureExtensions(): Promise<void> {
        try {
            // Execute each extension creation separately without semicolons
            await this.client.query('CREATE EXTENSION IF NOT EXISTS vector');
            await this.client.query('CREATE EXTENSION IF NOT EXISTS fuzzystrmatch');
            
            logger.info("Required PGLite extensions verified");
        } catch (error) {
            logger.error("Failed to create required extensions:", error);
            throw new Error(`Failed to create required extensions: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async runMigrations(): Promise<void> {
        try {
            // Wait for client to be ready
            await this.client.waitReady;
            
            // Ensure extensions exist before running migrations
            await this.ensureExtensions();
            
            
            // Get all SQL migration files
            const migrationsDir = path.resolve(__dirname, "../drizzle/migrations");
            const files = await fs.readdir(migrationsDir);
            const migrationFiles = files.filter(f => f.endsWith('.sql'));
            
            // Sort migration files to ensure correct order
            migrationFiles.sort();
            
            // Process each migration file
            for (const migrationFile of migrationFiles) {
                const migrationPath = path.join(migrationsDir, migrationFile);
                const migrationContent = await fs.readFile(migrationPath, 'utf8');
                
                // Split the content into individual SQL statements
                const statements = migrationContent
                    .split(/(?<!--);\s*(?=(?:[^']*'[^']*')*[^']*$)/g)
                    .map(stmt => stmt.trim())
                    .filter(stmt => {
                        // Filter out empty statements and statement-breakpoint comments
                        return stmt.length > 0 && !stmt.includes('--> statement-breakpoint');
                    });
                
                // Execute each statement separately
                for (const statement of statements) {
                    try {
                        if (statement.toLowerCase().includes('create extension')) {
                            // Skip extension creation as we handle it separately
                            continue;
                        }
                        await this.client.query(statement);
                    } catch (error) {
                        // Ignore errors about existing tables/constraints
                        if (error instanceof Error && 
                            !error.message.includes('already exists')) {
                            throw error;
                        }
                    }
                }
                
                logger.info(`Migration ${migrationFile} completed`);
            }
            
            logger.info("All migrations completed successfully!");
        } catch (error) {
            logger.error("Failed to run database migrations:", error);
            throw error;
        }
    }
}
