import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

import {
    AgentRuntime,
    CacheManager,
    DbCacheAdapter,
    logger,
    stringToUuid,
    TestSuite,
    type IAgentRuntime,
    type IDatabaseAdapter,
    type IDatabaseCacheAdapter
} from "@elizaos/core";
import { afterAll, beforeAll, describe, it } from 'vitest';
import { defaultCharacter } from "./defaultCharacter";

let runtime: IAgentRuntime;
let db: IDatabaseAdapter & IDatabaseCacheAdapter;

// Helper to create a database adapter
async function findDatabaseAdapter(runtime: IAgentRuntime) {
    const { adapters } = runtime;
    let adapter;
    
    // Default to sqlite if no adapter found
    if (adapters.length === 0) {
        const sqliteAdapter = await import('@elizaos-plugins/sqlite');
        adapter = sqliteAdapter.default.adapters[0];
        if (!adapter) {
            throw new Error("No database adapter found in default sqlite plugin");
        }
    } else if (adapters.length === 1) {
        adapter = adapters[0];
    } else {
        throw new Error("Multiple database adapters found. Ensure only one database adapter plugin is loaded.");
    }
    
    return adapter.init(runtime);
}

// Initialize the runtime with default character
beforeAll(async () => {
    try {
        // Setup character
        const character = { ...defaultCharacter };
        character.id = stringToUuid(character.name);
        character.username = character.name;

        // Create runtime
        runtime = new AgentRuntime({
            character,
            fetch: async (url: string, options: any) => {
                logger.debug(`Test fetch: ${url}`);
                return fetch(url, options);
            }
        });

        // Initialize database
        db = await findDatabaseAdapter(runtime);
        runtime.databaseAdapter = db;

        // Initialize cache
        const cache = new CacheManager(new DbCacheAdapter(db, character.id));
        runtime.cacheManager = cache;

        // Initialize runtime (loads plugins, etc)
        await runtime.initialize();

        logger.info(`Test runtime initialized for ${character.name}`);
    } catch (error) {
        logger.error("Failed to initialize test runtime:", error);
        throw error;
    }
});

// Cleanup after all tests
afterAll(async () => {
    try {
        if (runtime) {
            // await runtime.shutdown();
        }
        if (db) {
            await db.close();
        }
    } catch (error) {
        logger.error("Error during cleanup:", error);
        throw error;
    }
});

// Main test suite that runs all plugin tests
describe('Plugin Tests', async () => {
    it('should run all plugin tests', async () => {
        const plugins = runtime.plugins;
        
        // Track test statistics
        const stats = {
            total: 0,
            passed: 0,
            failed: 0,
            skipped: 0
        };

        // Run tests for each plugin
        for (const plugin of plugins) {
            if (typeof plugin.tests !== 'function') {
                logger.info(`Plugin ${plugin.name} has no tests`);
                continue;
            }

            try {
                logger.info(`Running tests for plugin: ${plugin.name}`);
                const tests = plugin.tests;
                const suites = (Array.isArray(tests) ? tests : [tests]) as TestSuite[];

                for (const suite of suites) {
                    logger.info(`\nTest suite: ${suite.name}`);
                    for (const test of suite.tests) {
                        stats.total++;
                        const startTime = performance.now();

                        try {
                            await test.fn();
                            stats.passed++;
                            const duration = performance.now() - startTime;
                            logger.info(`✓ ${test.name} (${Math.round(duration)}ms)`);
                        } catch (error) {
                            stats.failed++;
                            logger.error(`✗ ${test.name}`);
                            logger.error(error);
                            throw error;
                        }
                    }
                }
            } catch (error) {
                logger.error(`Error in plugin ${plugin.name}:`, error);
                throw error;
            }
        }

        // Log final statistics
        logger.info('\nTest Summary:');
        logger.info(`Total: ${stats.total}`);
        logger.info(`Passed: ${stats.passed}`);
        logger.info(`Failed: ${stats.failed}`);
        logger.info(`Skipped: ${stats.skipped}`);
    });
});