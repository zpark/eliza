
import dotenv from "dotenv";
dotenv.config({ path: '../../.env' });

import type { Character, IAgentRuntime } from "@elizaos/core";
import communityManager from "./communityManager";
import complianceOfficer from "./complianceOfficer";
import socialMediaManager from "./socialMediaManager";
import liaison from "./liaison";
import projectManager from "./projectManager";
import devSupport from "./devSupport";

export const swarm: {character: Character, init: (runtime: IAgentRuntime) => void}[] = [
  complianceOfficer,
  communityManager,
  socialMediaManager,
  liaison,
  projectManager,
  devSupport,
];

export default swarm;