import type {
    Character,
    IAgentRuntime
} from "@elizaos/core";
import type {
    Client
} from "discord.js";

export interface IDiscordClient {
    client: Client;
    runtime: IAgentRuntime;
    character: Character;
}