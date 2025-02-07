import { SqliteDatabaseAdapter, loadVecExtensions } from "@elizaos-plugins/adapter-sqlite";
import type { DatabaseAdapter } from "../database.ts";
import { AgentRuntime } from "../runtime.ts";
import { type Action, type Evaluator, ModelProviderName, type Provider } from "../types.ts";
import {
    SUPABASE_ANON_KEY,
    SUPABASE_URL,
    TEST_EMAIL,
    TEST_PASSWORD,
    zeroUuid,
} from "./constants.ts";
import type { User } from "./types.ts";

/**
 * Creates a runtime environment for the agent.
 *
 * @param {Object} param - The parameters for creating the runtime.
 * @param {Record<string, string> | NodeJS.ProcessEnv} [param.env] - The environment variables.
 * @param {number} [param.conversationLength] - The length of the conversation.
 * @param {Evaluator[]} [param.evaluators] - The evaluators to be used.
 * @param {Action[]} [param.actions] - The actions to be used.
 * @param {Provider[]} [param.providers] - The providers to be used.
 * @returns {Object} An object containing the created user, session, and runtime.
 */
export async function createRuntime({
    env,
    conversationLength,
    evaluators = [],
    actions = [],
    providers = [],
}: {
    env?: Record<string, string> | NodeJS.ProcessEnv;
    conversationLength?: number;
    evaluators?: Evaluator[];
    actions?: Action[];
    providers?: Provider[];
}) {
    // Use ONLY the SQLite adapter.
    const module = await import("better-sqlite3");
    const Database = module.default;

    const adapter: DatabaseAdapter = new SqliteDatabaseAdapter(new Database(":memory:"));
    // Load any required sqlite extensions.
    await loadVecExtensions(adapter.db);

    const user: User = {
        id: zeroUuid,
        email: "test@example.com",
    };
    const session = { user };

    // Ensure environment variables are provided.
    if (!env || !env.PROVIDER_API_KEY) {
        throw new Error("Missing PROVIDER_API_KEY in environment variables.");
    }

    const runtime = new AgentRuntime({
        serverUrl: "http://localhost",
        conversationLength,
        token: env.PROVIDER_API_KEY,
        modelProvider: ModelProviderName.OPENAI,
        actions: actions ?? [],
        evaluators: evaluators ?? [],
        providers: providers ?? [],
        databaseAdapter: adapter,
    });

    return { user, session, runtime };
}
