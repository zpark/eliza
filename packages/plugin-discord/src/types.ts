import {
    type Character,
    type IAgentRuntime
} from "@elizaos/core";
import {
    Client
} from "discord.js";

export interface IDiscordClient {
    apiToken: string;
    client: Client;
    runtime: IAgentRuntime;
    character: Character;
    stop(): Promise<void>;
}