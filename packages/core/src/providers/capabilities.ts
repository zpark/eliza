import { logger } from "../logger";
import type { IAgentRuntime, Memory, Provider, Service, State } from "../types";

/**
 * Provider that collects capability descriptions from all registered services
 */
export const capabilitiesProvider: Provider = {
  name: "capabilities",
  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State
  ): Promise<string> => {
    try {
      // Get all registered services
      const services = runtime.getAllServices();
      
      if (!services || services.size === 0) {
        return "No services are currently registered.";
      }
      
      // Extract capability descriptions from all services
      const capabilities: string[] = [];
      
      for (const [serviceType, service] of services) {
        if (service.capabilityDescription) {
          capabilities.push(`${serviceType} - ${service.capabilityDescription.replace("{{agentName}}", runtime.character.name)}`);
        }
      }
      
      if (capabilities.length === 0) {
        return "No capability descriptions found in the registered services.";
      }
      
      // Format the capabilities into a readable list
      const formattedCapabilities = capabilities.join("\n");
      
      return `# ${runtime.character.name}'s Capabilities\n\n${formattedCapabilities}`;
    } catch (error) {
      logger.error("Error in capabilities provider:", error);
      return "Error retrieving capabilities from services.";
    }
  }
};

export default capabilitiesProvider;
