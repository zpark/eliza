import { addHeader } from "../prompts";
import { IAgentRuntime, Memory, Provider } from "../types";

export const knowledgeProvider: Provider = {
  name: "knowledge",
  description: "Knowledge from the knowledge base",
  get: async (
    runtime: IAgentRuntime,
    message: Memory,
  ) => {    
    const knowledgeData = await runtime.getKnowledge(message);

    const knowledge = knowledgeData && knowledgeData.length > 0
      ? addHeader("# Knowledge", knowledgeData.map((knowledge) => `- ${knowledge.content.text}`).join("\n"))
      : "";
      
    return {
      data: {
        knowledge,
      },
      values: {
        knowledge,
      },
      text: knowledge,
    };
  },
};
