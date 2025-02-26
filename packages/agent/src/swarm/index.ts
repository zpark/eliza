
import dotenv from "dotenv";
dotenv.config({ path: '../../.env' });

import type { Character, IAgentRuntime } from "@elizaos/core";
import communityManager from "./communityManager";
import complianceOfficer from "./complianceOfficer";
import socialMediaManager from "./socialMediaManager";
import counselor from "./counselor";

export const swarm: {character: Character, init: (runtime: IAgentRuntime) => Promise<void>}[] = [
  complianceOfficer,
  communityManager,
  // socialMediaManager,
  // counselor,
];

export default swarm;