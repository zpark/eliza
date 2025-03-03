import { type Client, type IAgentRuntime, logger, type Plugin } from "@elizaos/core";
import { type Context, Telegraf } from "telegraf";
import replyAction from "./actions/reply.ts";
import { validateTelegramConfig } from "./environment.ts";
import { MessageManager } from "./messageManager.ts";
import { TelegramTestSuite } from "./tests.ts";
import { TELEGRAM_CLIENT_NAME } from "./constants.ts";

export class TelegramClient implements Client {
    name = TELEGRAM_CLIENT_NAME;
    private bot: Telegraf<Context>;
    private runtime: IAgentRuntime;
    public messageManager: MessageManager;
    private options;

    constructor(runtime: IAgentRuntime, botToken: string) {
        logger.log("📱 Constructing new TelegramClient...");
        this.options = {
            telegram: {
                apiRoot: runtime.getSetting("TELEGRAM_API_ROOT") || process.env.TELEGRAM_API_ROOT || "https://api.telegram.org"
            },
        };
        this.runtime = runtime;
        this.bot = new Telegraf(botToken,this.options);
        this.messageManager = new MessageManager(this.bot, this.runtime);
        logger.log("✅ TelegramClient constructor completed");
    }

    static async start(runtime: IAgentRuntime): Promise<TelegramClient> {
        await validateTelegramConfig(runtime);

        const tg = new TelegramClient(
            runtime,
            runtime.getSetting("TELEGRAM_BOT_TOKEN")
        );

        logger.success(
            `✅ Telegram client successfully started for character ${runtime.character.name}`
        );

        logger.log("🚀 Starting Telegram bot...");
        try {
            await tg.initializeBot();
            tg.setupMessageHandlers();
        } catch (error) {
            logger.error("❌ Failed to launch Telegram bot:", error);
            throw error;
        }
        return tg;
    }

    static async stop(runtime: IAgentRuntime) {
        // Implement shutdown if necessary
    }
    
    private async initializeBot(): Promise<void> {
        this.bot.launch({ dropPendingUpdates: true, allowedUpdates: [ "message", "message_reaction" ] });
        logger.log("✨ Telegram bot successfully launched and is running!");

        const botInfo = await this.bot.telegram.getMe();
        this.bot.botInfo = botInfo;
        logger.success(`Bot username: @${botInfo.username}`);

        this.messageManager.bot = this.bot;
        
        // Emit standardized event that we've connected
        // this.runtime.emitEvent("SERVER_CONNECTED", {
        //     name: "Telegram",
        //     runtime: this.runtime,
        //     server: {
        //         id: "telegram-main",
        //         name: "Telegram"
        //     },
        //     source: "telegram"
        // });
    }

    private async isGroupAuthorized(ctx: Context): Promise<boolean> {
        const config = this.runtime.character.settings?.telegram;
        if (ctx.from?.id === ctx.botInfo?.id) {
            return false;
        }

        if (!config?.shouldOnlyJoinInAllowedGroups) {
            return true;
        }

        const allowedGroups = config.allowedGroupIds || [];
        const currentGroupId = ctx.chat.id.toString();

        if (!allowedGroups.includes(currentGroupId)) {
            logger.info(`Unauthorized group detected: ${currentGroupId}`);
            try {
                await ctx.reply("Not authorized. Leaving.");
                await ctx.leaveChat();
            } catch (error) {
                logger.error(
                    `Error leaving unauthorized group ${currentGroupId}:`,
                    error
                );
            }
            return false;
        }

        return true;
    }

    private setupMessageHandlers(): void {
        // Regular message handler
        this.bot.on("message", async (ctx) => {
            try {
                if (!(await this.isGroupAuthorized(ctx))) return;
                await this.messageManager.handleMessage(ctx);
            } catch (error) {
                logger.error("Error handling message:", error);
            }
        });

        // Reaction handler
        this.bot.on("message_reaction", async (ctx) => {
            try {
                if (!(await this.isGroupAuthorized(ctx))) return;
                await this.messageManager.handleReaction(ctx);
            } catch (error) {
                logger.error("Error handling reaction:", error);
            }
        });
    }
}

const telegramPlugin: Plugin = {
    name: TELEGRAM_CLIENT_NAME,
    description: "Telegram client plugin",
    clients: [TelegramClient],
    actions: [replyAction],
    tests: [new TelegramTestSuite()]
};
export default telegramPlugin;
