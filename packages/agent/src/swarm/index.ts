
import dotenv from "dotenv";
dotenv.config({ path: '../../.env' });

import type { Character, IAgentRuntime, Plugin } from "@elizaos/core";
import communityManager from "./communityManager";
import devRel from "./devRel";
import investmentManager from "./investmentManager";
import liaison from "./liaison";
import projectManager from "./projectManager";
import socialMediaManager from "./socialMediaManager";

export const swarm: {character: Character, init: (runtime: IAgentRuntime) => void, plugins?: Plugin[]}[] = [
  investmentManager,
  // communityManager,
  // socialMediaManager,
  // liaison,
  // projectManager,
  // devRel,
];

export default swarm;