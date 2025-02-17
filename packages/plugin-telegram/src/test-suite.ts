import {
  logger,
  type TestSuite,
  type IAgentRuntime,
  ModelClass,
} from "@elizaos/core";
import { Telegraf } from "telegraf";
import { MessageManager } from "./messageManager";
import { Context } from "telegraf";
import { TelegramClient } from "./telegramClient";

export class TelegramTestSuite implements TestSuite {
  name = "telegram";
  private telegramClient: TelegramClient = null;
  private bot: Telegraf<Context> | null = null;
  private messageManager: MessageManager | null = null;
  tests: { name: string; fn: (runtime: IAgentRuntime) => Promise<void> }[];

  constructor() {
    this.tests = [
      {
        name: "Initialize Telegram Bot",
        fn: this.testCreatingTelegramBot.bind(this),
      },
      {
        name: "Send Message",
        fn: this.testSendingTextMessage.bind(this),
      },
      {
        name: "Handle Incoming Messages",
        fn: this.testHandlingMessage.bind(this),
      },
      {
        name: "Process Image Attachments",
        fn: this.testProcessingImages.bind(this),
      },
    ];
  }

  async testCreatingTelegramBot(runtime: IAgentRuntime) {
    this.telegramClient = runtime.getClient("telegram") as TelegramClient;
    this.bot = this.telegramClient.messageManager.bot;
    this.messageManager = this.telegramClient.messageManager;
    logger.success("Telegram bot initialized successfully.");
  }

  async testSendingTextMessage(runtime: IAgentRuntime) {
    try {
      if (!this.bot) throw new Error("Bot not initialized.");

      const chatId = "-4697450961";
      await this.bot.telegram.sendMessage(chatId, "Testing Telegram message!");
      logger.success("Message sent successfully.");
    } catch (error) {
      throw new Error(`Error sending Telegram message: ${error}`);
    }
  }

  async testHandlingMessage(runtime: IAgentRuntime) {
    try {
      const mockContext: Partial<Context> = {
        chat: { id: "-4697450961", type: "private" } as any,
        from: { id: "mock-user-id", username: "TestUser" } as any,
        message: {
          message_id: undefined,
          text: `@${this.bot.botInfo?.username}! Hello!`,
          date: Math.floor(Date.now() / 1000),
        } as any,
        telegram: this.bot.telegram,
      };

      try {
        await this.messageManager.handleMessage(mockContext as Context);
      } catch (error) {
        throw new Error(`Error handling Telegram message: ${error}`);
      }
    } catch (error) {
      throw new Error(`Error handling Telegram message: ${error}`);
    }
  }

  async testProcessingImages(runtime: IAgentRuntime) {
    try {
      const fileId = await this.getFileId(
        "-4697450961",
        "https://framerusercontent.com/images/mDAWprGNvWKmeBK2cEi97gPWI.png"
      );

      const mockMessage = {
        message_id: undefined,
        date: Math.floor(Date.now() / 1000),
        photo: [{ file_id: fileId }],
        text: `@${this.bot.botInfo?.username}!`,
      };

      const { description } = await this.messageManager.processImage(
        mockMessage as any
      );
      if (!description) {
        throw new Error("Error processing Telegram image");
      } else {
        logger.log(`Processing Telegram image successfully: ${description}`);
      }
    } catch (error) {
      throw new Error(`Error processing Telegram image: ${error}`);
    }
  }

  async getFileId(chatId: string, imageUrl: string) {
    try {
      const message = await this.bot.telegram.sendPhoto(chatId, imageUrl);
      return message.photo[message.photo.length - 1].file_id;
    } catch (error) {
      console.error("Error sending image:", error);
    }
  }
}
