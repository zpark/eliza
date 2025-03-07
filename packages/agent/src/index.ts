import dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

import {
  AgentRuntime,
  type Character,
  type IAgentRuntime,
  type IDatabaseAdapter,
  logger,
  parseBooleanFromText,
  settings,
  stringToUuid,
  type Plugin
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
import { character as defaultCharacter } from "./swarm/communityManager";

import * as fs from "node:fs";
import * as path from "node:path";
import swarm from "./swarm/index";
import { createDatabaseAdapter } from "@elizaos/plugin-sql";

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

async function startAgent(
  character: Character,
  server: AgentServer,
  init?: (runtime: IAgentRuntime) => void,
  plugins: Plugin[] = []
): Promise<IAgentRuntime> {
  let db: IDatabaseAdapter;
  try {
    character.id ??= stringToUuid(character.name);

    const runtime = new AgentRuntime({
      character,
      fetch: logFetch,
      plugins
    });

    if (init) {
      await init(runtime);
    }

    // initialize database
    // find a db from the plugins
    db = await createDatabaseAdapter({
      dataDir: path.join(process.cwd(), "data"),
      postgresUrl: process.env.POSTGRES_URL,
    }, runtime.agentId);
    runtime.databaseAdapter = db;

    // Make sure character exists in database
    await runtime.databaseAdapter.ensureAgentExists(character);

    // start services/plugins/process knowledge    
    await runtime.initialize();

    // add to container
    server.registerAgent(runtime);
    
    // report to console
    logger.debug(`Started ${runtime.character.name} as ${runtime.agentId}`);

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

async function stopAgent(
  runtime: IAgentRuntime,
  server: AgentServer
) {
  await runtime.databaseAdapter.close();
  server.unregisterAgent(runtime.agentId);
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
  server.stopAgent = (runtime: IAgentRuntime) => {
    stopAgent(runtime, server);
  }
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
          swarmMember.init,
          swarmMember.plugins
        );
        members.push(runtime);
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
