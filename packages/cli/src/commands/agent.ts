import { handleError } from "@/src/utils/handle-error"
import { displayAgent } from "@/src/utils/helpers"
import { logger } from "@/src/utils/logger"
import { Command } from "commander"
import fs from "node:fs"
import path from "node:path"

const AGENT_RUNTIME_URL = process.env.AGENT_RUNTIME_URL?.replace(/\/$/, '') || 'http://localhost:3000'
const AGENTS_BASE_URL = `${AGENT_RUNTIME_URL}/agents`

// Utility function to resolve agent ID from name, index, or direct ID
async function resolveAgentId(nameOrIndex: string): Promise<string> {
  // First try to get all agents to find by name
  const listResponse = await fetch(`${AGENTS_BASE_URL}`);
  const { agents } = await listResponse.json();
      
  // Try to find agent by name (case insensitive)
  const agentByName = agents.find(
    agent => agent.name.toLowerCase() === nameOrIndex.toLowerCase()
  );

  // Use agent ID from name match, or try direct ID/index
  return agentByName ? agentByName.id 
    : !Number.isNaN(Number(nameOrIndex))
      ? await getAgentIdFromIndex(Number.parseInt(nameOrIndex))
      : nameOrIndex;
}

export const agent = new Command()
  .name("agent")
  .description("manage ElizaOS agents")

interface AgentStartPayload {
  characterPath?: string;
  characterJson?: Record<string, unknown>;
}

interface AgentErrorResponse {
  error: string;
}

interface AgentStartResponse {
  id: string;
  character: {
    name: string;
    [key: string]: unknown;
  };
}

async function getAgentIdFromIndex(index: number): Promise<string> {
  const listResponse = await fetch(`${AGENTS_BASE_URL}`)
  const { agents } = await listResponse.json()
  
  const sortedAgents = agents.sort((a, b) => a.name.localeCompare(b.name))
  
  if (index < 0 || index >= sortedAgents.length) {
    throw new Error(`Invalid index: ${index}. Must be between 0 and ${sortedAgents.length - 1}`)
  }
  
  return sortedAgents[index].id
}

agent
  .command("list")
  .alias("ls")
  .description("list available agents")
  .option("-j, --json", "output as JSON")
  .action(async (opts) => {
    try {
      const response = await fetch(`${AGENTS_BASE_URL}`)
      const { agents } = await response.json()

      // Sort agents by name
      const sortedAgents = agents.sort((a, b) => a.name.localeCompare(b.name))
      
      // Format data for table
      const agentData = sortedAgents.map(agent => ({
        Name: agent.name,
        ID: agent.id,
        Clients: agent.clients.join(", ")
      }))

      if (opts.json) {
        logger.info(JSON.stringify(agentData, null, 2))
      } else {
        logger.info("\nAvailable agents:")
        if (agentData.length === 0) {
          logger.info("No agents found")
        } else {
          console.table(agentData)
        }
      }

      process.exit(0)
    } catch (error) {
      handleError(error)
    }
  })

agent
  .command("get")
  .alias("g")
  .description("get agent details")
  .requiredOption("-n, --name <name>", "agent id, name, or index number from list")
  .option("-j, --json", "output as JSON")
  .option("-o, --output <file>", "output to file (default: {name}.json)")
  .action(async (opts) => {
    try {
      const resolvedAgentId = await resolveAgentId(opts.name);
      
      logger.info(`Getting agent ${resolvedAgentId}`)

      const response = await fetch(`${AGENTS_BASE_URL}/${resolvedAgentId}`)
      if (!response.ok) {
        throw new Error(`Failed to get agent: ${response.statusText}`)
      }
      
      const agent = await response.json()

      displayCharacter(agent.character, "Agent Details")

      // check if json argument is provided
      if (opts.json) {
        const jsonPath = opts.output || path.join(process.cwd(), `${agent.character.name}.json`)
        // exclude .id field from the json
        const { id, ...character } = agent.character
        fs.writeFileSync(jsonPath, JSON.stringify(character, null, 2))
      }

      process.exit(0)

    } catch (error) {
      handleError(error)
    }
  })

agent
  .command("start")
  .alias("s")
  .description("start an agent")
  .option("-n, --name <name>", "character name to start the agent with")
  .option("-j, --json <json>", "character JSON string")
  .option("-p, --path <path>", "local path to character JSON file")
  .option("-r, --remote <url>", "remote URL to character JSON file")
  .action(async (opts) => {
    try {
      const response: Response = await (async () => {
        const payload: AgentStartPayload = {};

        // Determine which start option to use
        const startOption = opts.json ? 'json'
          : opts.remote ? 'remote'
          : opts.path ? 'path'
          : opts.name ? 'name'
          : 'none';

        switch (startOption) {
          case 'json':
            payload.characterJson = JSON.parse(opts.json);
            return await fetch(`${AGENTS_BASE_URL}/start`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });

          case 'remote':
            if (!opts.remote.startsWith('http://') && !opts.remote.startsWith('https://')) {
              throw new Error('Remote URL must start with http:// or https://');
            }
            payload.characterPath = opts.remote;
            return await fetch(`${AGENTS_BASE_URL}/start`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });

          case 'path':
            try {
              const fileContent = fs.readFileSync(opts.path, 'utf8');
              payload.characterJson = JSON.parse(fileContent);
              return await fetch(`${AGENTS_BASE_URL}/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });
            } catch (error) {
              throw new Error(`Failed to read or parse local JSON file: ${error.message}`);
            }

          case 'name':
            return await fetch(`${AGENTS_BASE_URL}/start/${encodeURIComponent(opts.name)}`, {
              method: 'POST'
            });

          default:
            throw new Error("Please provide either a character name, path to JSON file, remote URL, or character JSON string");
        }
      })();

      if (!response.ok) {
        const errorData = await response.json() as AgentErrorResponse;
        throw new Error(errorData.error || `Failed to start agent: ${response.statusText}`);
      }

      const result = await response.json() as AgentStartResponse;
      logger.success(`Successfully started agent ${result.character.name} (${result.id})`);
    } catch (error) {
      handleError(error);
    }
  });

agent
  .command("stop")
  .alias("st")
  .description("stop an agent")
  .requiredOption("-n, --name <name>", "agent id, name, or index number from list")
  .action(async (opts) => {
    try {
      const resolvedAgentId = await resolveAgentId(opts.name);

      const response = await fetch(`${AGENTS_BASE_URL}/${resolvedAgentId}/stop`, {
        method: 'POST'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to stop agent: ${response.statusText}`);
      }

      logger.success(`Successfully stopped agent ${opts.name}`);
    } catch (error) {
      handleError(error);
    }
  });

agent
  .command("remove")
  .alias("rm")
  .description("remove an agent")
  .requiredOption("-n, --name <name>", "agent id, name, or index number from list")
  .action(async (opts) => {
    try {
      const resolvedAgentId = await resolveAgentId(opts.name);

      const response = await fetch(`${AGENTS_BASE_URL}/${resolvedAgentId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to remove agent: ${response.statusText}`);
      }

      logger.success(`Successfully removed agent ${opts.name}`);
    } catch (error) {
      handleError(error);
    }
  });

agent
  .command("set")
  .description("update agent configuration")
  .requiredOption("-n, --name <name>", "agent id, name, or index number from list")
  .option("-c, --config <json>", "configuration as JSON string")
  .option("-f, --file <path>", "path to configuration JSON file")
  .action(async (opts) => {
    try {
      const resolvedAgentId = await resolveAgentId(opts.name);

      let config: Record<string, unknown>;
      if (opts.config) {
        config = JSON.parse(opts.config);
      } else if (opts.file) {
        config = JSON.parse(fs.readFileSync(opts.file, 'utf8'));
      } else {
        throw new Error("Please provide either a config JSON string (-c) or a config file path (-f)");
      }

      const response = await fetch(`${AGENTS_BASE_URL}/${resolvedAgentId}/set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to update agent configuration: ${response.statusText}`);
      }

      const result = await response.json();
      logger.success(`Successfully updated configuration for agent ${result.id}`);
    } catch (error) {
      handleError(error);
    }
  });

