import { describe, it, expect, vi, beforeEach } from "vitest";
import { MessageManager } from "../src/messages.ts";
import { ChannelType, Client, Collection } from "discord.js";
import { type IAgentRuntime } from "@elizaos/core";
import type { VoiceManager } from "../src/voice";

vi.mock("@elizaos/core", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  stringToUuid: (str: string) => str,
  messageCompletionFooter:
    "# INSTRUCTIONS: Choose the best response for the agent.",
  shouldRespondFooter: "# INSTRUCTIONS: Choose if the agent should respond.",
  generateMessageResponse: vi.fn(),
  generateShouldRespond: vi.fn().mockResolvedValue("IGNORE"), // Prevent API calls by always returning "IGNORE"
  composeContext: vi.fn(),
  ModelClass: {
    TEXT_SMALL: "TEXT_SMALL",
  },
  ServiceType: {
    VIDEO: "VIDEO",
    BROWSER: "BROWSER",
  },
}));

describe("Discord MessageManager", () => {
  let mockRuntime: IAgentRuntime;
  let mockClient: Client;
  let mockDiscordClient: { client: Client; runtime: IAgentRuntime };
  let mockVoiceManager: VoiceManager;
  let mockMessage: any;
  let messageManager: MessageManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRuntime = {
      character: {
        name: "TestBot",
        templates: {},
        clientConfig: {
          discord: {
            allowedChannelIds: ["mock-channal-id"],
            shouldIgnoreBotMessages: true,
            shouldIgnoreDirectMessages: true,
          },
        },
      },
      evaluate: vi.fn(),
      composeState: vi.fn(),
      ensureConnection: vi.fn(),
      ensureUserExists: vi.fn(),
      messageManager: {
        createMemory: vi.fn(),
        addEmbeddingToMemory: vi.fn(),
      },
      databaseAdapter: {
        getParticipantUserState: vi.fn().mockResolvedValue("ACTIVE"),
        log: vi.fn(),
      },
      processActions: vi.fn(),
    } as unknown as IAgentRuntime;

    mockClient = new Client({ intents: [] });
    mockClient.user = {
      id: "mock-bot-id",
      username: "MockBot",
      tag: "MockBot#0001",
      displayName: "MockBotDisplay",
    } as any;

    mockDiscordClient = {
      client: mockClient,
      runtime: mockRuntime,
    };

    mockVoiceManager = {
      playAudioStream: vi.fn(),
    } as unknown as VoiceManager;

    messageManager = new MessageManager(mockDiscordClient, mockVoiceManager);

    const guild = {
      members: {
        cache: {
          get: vi.fn().mockReturnValue({
            nickname: "MockBotNickname",
            permissions: {
              has: vi.fn().mockReturnValue(true), // Bot has permissions
            },
          }),
        },
      },
    };
    mockMessage = {
      content: "Hello, MockBot!",
      author: {
        id: "mock-user-id",
        username: "MockUser",
        bot: false,
      },
      guild,
      channel: {
        id: "mock-channal-id",
        type: ChannelType.GuildText,
        send: vi.fn(),
        guild,
        client: {
          user: mockClient.user,
        },
        permissionsFor: vi.fn().mockReturnValue({
          has: vi.fn().mockReturnValue(true),
        }),
      },
      id: "mock-message-id",
      createdTimestamp: Date.now(),
      mentions: {
        has: vi.fn().mockReturnValue(false),
      },
      reference: null,
      attachments: [],
    };
  });

  it("should initialize MessageManager", () => {
    expect(messageManager).toBeDefined();
  });

  it("should process user messages", async () => {
    // Prevent further message processing after response check
    vi.spyOn(
      Object.getPrototypeOf(messageManager),
      "_shouldRespond"
    ).mockReturnValueOnce(false);

    await messageManager.handleMessage(mockMessage);
    expect(mockRuntime.ensureConnection).toHaveBeenCalled();
    expect(mockRuntime.messageManager.createMemory).toHaveBeenCalled();
  });

  it("should ignore bot messages", async () => {
    mockMessage.author.bot = true;
    await messageManager.handleMessage(mockMessage);
    expect(mockRuntime.ensureConnection).not.toHaveBeenCalled();
  });

  it("should ignore messages from restricted channels", async () => {
    mockMessage.channel.id = "undefined-channel-id";
    await messageManager.handleMessage(mockMessage);
    expect(mockRuntime.ensureConnection).not.toHaveBeenCalled();
  });

  it.each([
    ["Hey MockBot, are you there?", "username"],
    ["MockBot#0001, respond please.", "tag"],
    ["MockBotNickname, can you help?", "nickname"],
    ["MoCkBoT, can you help?", "mixed case mention"],
  ])(
    "should respond if the bot name is included in the message",
    async (content) => {
      mockMessage.content = content;

      const result = await messageManager["_shouldRespond"](
        mockMessage,
        {} as any
      );
      expect(result).toBe(true);
    }
  );

  it("should process audio attachments", async () => {
    vi.spyOn(
      Object.getPrototypeOf(messageManager),
      "_shouldRespond"
    ).mockReturnValueOnce(false);
    vi.spyOn(messageManager, "processMessageMedia").mockReturnValueOnce(
      Promise.resolve({ processedContent: "", attachments: [] })
    );

    const myVariable = new Collection<string, any>([
      [
        "mock-attachment-id",
        {
          attachment: "https://www.example.mp3",
          name: "mock-attachment.mp3",
          contentType: "audio/mpeg",
        },
      ],
    ]);

    mockMessage.attachments = myVariable;

    const processAttachmentsMock = vi.fn().mockResolvedValue([]);

    const mockAttachmentManager = {
      processAttachments: processAttachmentsMock,
    } as unknown as (typeof messageManager)["attachmentManager"];

    // Override the private property with a mock
    Object.defineProperty(messageManager, "attachmentManager", {
      value: mockAttachmentManager,
      writable: true,
    });

    await messageManager.handleMessage(mockMessage);

    expect(processAttachmentsMock).toHaveBeenCalled();
  });
});
