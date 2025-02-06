import {
    elizaLogger,
    type Plugin,
} from "@elizaos/core";
import type { Client, IAgentRuntime } from "@elizaos/core";
import { TelegramClient } from "./telegramClient.ts";
import { validateTelegramConfig } from "./environment.ts";

const TelegramClientInterface: Client = {
    name: 'telegram',
    start: async (runtime: IAgentRuntime) => {
        await validateTelegramConfig(runtime);

        const tg = new TelegramClient(
            runtime,
            runtime.getSetting("TELEGRAM_BOT_TOKEN")
        );

        await tg.start();

        elizaLogger.success(
            `✅ Telegram client successfully started for character ${runtime.character.name}`
        );
        return tg;
    },
};
const telegramPlugin: Plugin = {
    name: "telegram",
    description: "Telegram client plugin",
    clients: [TelegramClientInterface],
};
export default telegramPlugin;
