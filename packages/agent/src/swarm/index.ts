
import dotenv from "dotenv";
dotenv.config({ path: '../../.env' });

import type { Character, IAgentRuntime } from "@elizaos/core";
import communityManager from "./communityManager";
import devRel from "./devRel";
import investmentManager from "./investmentManager";
import liaison from "./liaison";
import projectManager from "./projectManager";
import socialMediaManager from "./socialMediaManager";

export const swarm: {character: Character, init: (runtime: IAgentRuntime) => void}[] = [
  investmentManager,
  communityManager,
  socialMediaManager,
  liaison,
  projectManager,
  devRel,
];

export default swarm;