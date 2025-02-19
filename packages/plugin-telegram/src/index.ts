import {
    logger,
    type Client,
    type IAgentRuntime,
    type Plugin,
} from "@elizaos/core";
import { TelegramClient } from "./telegramClient.ts";
import { validateTelegramConfig } from "./environment.ts";
import { TelegramTestSuite } from "./test-suite.ts";
import replyAction from "./actions/reply.ts";


const TelegramClientInterface: Client = {
    name: 'telegram',
    start: async (runtime: IAgentRuntime) => {
        await validateTelegramConfig(runtime);

        const tg = new TelegramClient(
            runtime,
            runtime.getSetting("TELEGRAM_BOT_TOKEN")
        );

        await tg.start();

        logger.success(
            `✅ Telegram client successfully started for character ${runtime.character.name}`
        );
        return tg;
    },
};
const telegramPlugin: Plugin = {
    name: "telegram",
    description: "Telegram client plugin",
    clients: [TelegramClientInterface],
    actions: [replyAction],
    tests: [new TelegramTestSuite()]
};
export default telegramPlugin;
