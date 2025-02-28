import dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

import {
  type Adapter,
  AgentRuntime,
  CacheManager,
  CacheStore,
  type Character,
  DbCacheAdapter,
  type IAgentRuntime,
  type IDatabaseAdapter,
  type IDatabaseCacheAdapter,
  logger,
  parseBooleanFromText,
  settings,
  stringToUuid
} from "@elizaos/core";
import net from "node:net";
import yargs from "yargs";
import { AgentServer } from "./server/index.ts";
import {
  hasValidRemoteUrls,
  jsonToCharacter,
  loadCharacters,
  loadCharacterTryPath
} from "./server/loader.ts";
import { defaultCharacter } from "./single-agent/character.ts";
import { startScenario } from "./swarm/scenario.ts";

import * as fs from "node:fs";
import * as path from "node:path";
import swarm from "./swarm/index";

export const wait = (minTime = 1000, maxTime = 3000) => {
  const waitTime =
    Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
  return new Promise((resolve) => setTimeout(resolve, waitTime));
};

export const logFetch = async (url: string, options: RequestInit) => {
  logger.debug(`Fetching ${url}`);
  // Disabled to avoid disclosure of sensitive information such as API keys
  // logger.debug(JSON.stringify(options, null, 2));
  return fetch(url, options);
};

export function parseArguments(): {
  character?: string;
  characters?: string;
  swarm?: boolean;
  scenario?: boolean;
} {
  try {
    return yargs(process.argv.slice(2))
      .option("character", {
        type: "string",
        description: "Path to the character JSON file",
      })
      .option("characters", {
        type: "string",
        description: "Comma separated list of paths to character JSON files",
      })
      .option("swarm", {
        type: "boolean",
        description: "Load characters from swarm",
      })
      .option("scenario", {
        type: "boolean",
        description: "Run scenario tests",
      })
      // scenario filter
      .option("scenario-filter", {
        type: "string",
        description: "Filter scenario tests (only tests which contain this string)",
      })
      .parseSync();
  } catch (error) {
    logger.error("Error parsing arguments:", error);
    return {};
  }
}

export async function createAgent(
  character: Character
): Promise<IAgentRuntime> {
  logger.log(`Creating runtime for character ${character.name}`);
  return new AgentRuntime({
    character,
    fetch: logFetch,
  });
}

function initializeDbCache(character: Character, db: IDatabaseCacheAdapter) {
  if (!character?.id) {
    throw new Error(
      "initializeFsCache requires id to be set in character definition"
    );
  }
  const cache = new CacheManager(new DbCacheAdapter(db, character.id));
  return cache;
}

function initializeCache(
  cacheStore: string,
  character: Character,
  _baseDir?: string,
  db?: IDatabaseCacheAdapter
) {
  switch (cacheStore) {
    case CacheStore.DATABASE:
      if (db) {
        logger.info("Using Database Cache...");
        return initializeDbCache(character, db);
      }
      throw new Error(
        "Database adapter is not provided for CacheStore.Database."
      );

    default:
      throw new Error(
        `Invalid cache store: ${cacheStore} or required configuration missing.`
      );
  }
}

async function findDatabaseAdapter(server?: AgentServer, runtime?: IAgentRuntime) {
  if (server) {
    return server.database;
  }
  if (runtime) {
    return runtime.databaseAdapter;
  }
  
  throw new Error("No database adapter found");
}

async function startAgent(
  character: Character,
  server: AgentServer,
  init?: (runtime: IAgentRuntime) => Promise<void>
): Promise<IAgentRuntime> {
  let db: IDatabaseAdapter & IDatabaseCacheAdapter;
  try {
    character.id ??= stringToUuid(character.name);
    character.username ??= character.name;

    const runtime: IAgentRuntime = await createAgent(character);

    if (init) {
      await init(runtime);
    }

    // initialize database
    // find a db from the plugins
    db = await findDatabaseAdapter(server, runtime);
    runtime.databaseAdapter = db;

    // Make sure character exists in database
    await runtime.ensureCharacterExists(character);

    // Make sure agent points to character in database
    // TODO

    // initialize cache
    const cache = initializeCache(
      runtime.getSetting("CACHE_STORE") ?? CacheStore.DATABASE,
      character,
      "",
      db
    ); // "" should be replaced with dir for file system caching. THOUGHTS: might probably make this into an env
    runtime.cacheManager = cache;

    // start services/plugins/process knowledge    
    await runtime.initialize();

    // add to container
    server.registerAgent(runtime);
    

    // report to console
    logger.debug(`Started ${character.name} as ${runtime.agentId}`);

    return runtime;
  } catch (error) {
    logger.error(
      `Error starting agent for character ${character.name}:`,
      error
    );
    logger.error(error);
    if (db) {
      await db.close();
    }
    throw error;
  }
}

const checkPortAvailable = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        resolve(false);
      }
    });

    server.once("listening", () => {
      server.close();
      resolve(true);
    });

    server.listen(port);
  });
};

const startAgents = async () => {
  const server = new AgentServer();
  
  // Assign the required functions first
  server.startAgent = async (character) => {
    logger.info(`Starting agent for character ${character.name}`);
    return startAgent(character, server);
  };
  server.loadCharacterTryPath = loadCharacterTryPath;
  server.jsonToCharacter = jsonToCharacter;

  let serverPort = Number.parseInt(settings.SERVER_PORT || "3000");
  const args = parseArguments();
  const charactersArg = args.characters || args.character;
  
  // Add this before creating the AgentServer
  const dataDir = path.join(process.cwd(), "data");
  try {
    fs.accessSync(dataDir, fs.constants.W_OK);
    logger.debug(`Data directory ${dataDir} is writable`);
  } catch (error) {
    logger.error(`Data directory ${dataDir} is not writable:`, error);
  }

  if (args.swarm) {
    try {
        const members = [];
      for (const swarmMember of swarm) {
        const runtime = await startAgent(
          swarmMember.character,
          server,
          swarmMember.init
        );
        members.push(runtime);
      }
      if (args.scenario) {
        startScenario(members);
      }
      logger.info("Loaded characters from swarm configuration");
    } catch (error) {
      logger.error("Error loading swarm characters:", error);
      process.exit(1);
    }
  } else {
    let characters = [];
    if (charactersArg || hasValidRemoteUrls()) {
      characters = await loadCharacters(charactersArg);
    } else {
      characters = [defaultCharacter];
    }

    try {
      for (const character of characters) {
          await startAgent(character, server);
      }
    } catch (error) {
      logger.error("Error starting agents:", error);
    }
  }

  // Rest of the function remains the same...
  while (!(await checkPortAvailable(serverPort))) {
    logger.warn(`Port ${serverPort} is in use, trying ${serverPort + 1}`);
    serverPort++;
  }

  server.start(serverPort);

  if (serverPort !== Number.parseInt(settings.SERVER_PORT || "3000")) {
    logger.log(`Server started on alternate port ${serverPort}`);
  }

  logger.info(
    "Run `bun start:client` to start the client and visit the outputted URL (http://localhost:5173) to chat with your agents. When running multiple agents, use client with different port `SERVER_PORT=3001 bun start:client`"
  );
};

startAgents().catch((error) => {
  logger.error("Unhandled error in startAgents:", error.message);
  process.exit(1);
});

// Prevent unhandled exceptions from crashing the process if desired
if (
  process.env.PREVENT_UNHANDLED_EXIT &&
  parseBooleanFromText(process.env.PREVENT_UNHANDLED_EXIT)
) {
  // Handle uncaught exceptions to prevent the process from crashing
  process.on("uncaughtException", (err) => {
    console.error("uncaughtException", err);
  });

  // Handle unhandled rejections to prevent the process from crashing
  process.on("unhandledRejection", (err) => {
    console.error("unhandledRejection", err);
  });
}
