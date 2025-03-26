import type { Plugin } from '@elizaos/core';
import { CommunityManagerService } from './communityService';
import discordTimeoutUser from './actions/discord-timeout';

export const communityManagerPlugin: Plugin = {
  name: 'community manager plugin',
  description: 'community manager plugin plugin',
  evaluators: [],
  providers: [],
  actions: [discordTimeoutUser],
  services: [CommunityManagerService],
};

export default communityManagerPlugin;
