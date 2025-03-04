import type {
    Character,
    IAgentRuntime
} from "@elizaos/core";
import type {
    Client
} from "discord.js";

export interface IDiscordService {
    client: Client;
    runtime: IAgentRuntime;
    character: Character;
}

export const ServiceTypes = {
    DISCORD: "discord",
} as const;
