import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { validateEnv, validateCharacterConfig } from "../src/environment";
import { Clients, ModelProviderName } from "../src/types";

describe("Environment Configuration", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = {
            ...originalEnv,
            PROVIDER_NAME: "OPENAI",
            PROVIDER_API_KEY: "sk-test123",
            PROVIDER_ENDPOINT: "https://api.openai.com/v1",
            ELEVENLABS_XI_API_KEY: "test-key",
            DEFAULT_MODEL: "gpt-4",
            SMALL_MODEL: "gpt-3.5-turbo",
            MEDIUM_MODEL: "gpt-4",
            LARGE_MODEL: "gpt-4-turbo",
            EMBEDDING_MODEL: "text-embedding-3-small",
            IMAGE_MODEL: "dall-e-3",
            IMAGE_VISION_MODEL: "gpt-4-vision-preview",
        };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it("should validate correct environment variables", () => {
        expect(() => validateEnv()).not.toThrow();
    });

    it("should throw error for missing required provider configuration", () => {
        delete process.env.PROVIDER_NAME;
        delete process.env.PROVIDER_API_KEY;
        expect(() => validateEnv()).toThrow(
            "Environment validation failed:\n" +
            "PROVIDER_NAME: Required\n" +
            "PROVIDER_API_KEY: Required"
        );
    });

    it("should throw error for invalid provider endpoint URL", () => {
        process.env.PROVIDER_ENDPOINT = "invalid-url";
        expect(() => validateEnv()).toThrow(
            "Provider endpoint must be a valid URL"
        );
    });

    it("should validate with optional fields missing", () => {
        delete process.env.DEFAULT_MODEL;
        delete process.env.SMALL_MODEL;
        delete process.env.MEDIUM_MODEL;
        delete process.env.LARGE_MODEL;
        delete process.env.EMBEDDING_MODEL;
        delete process.env.IMAGE_MODEL;
        delete process.env.IMAGE_VISION_MODEL;
        delete process.env.ELEVENLABS_XI_API_KEY;
        expect(() => validateEnv()).not.toThrow();
    });

    it("should validate with invalid model provider name", () => {
        process.env.PROVIDER_NAME = "INVALID_PROVIDER";
        expect(() => validateEnv()).toThrow();
    });
});

describe("Character Configuration", () => {
    const validCharacterConfig = {
        name: "Test Character",
        modelProvider: ModelProviderName.OPENAI,
        bio: "Test bio",
        lore: ["Test lore"],
        messageExamples: [
            [
                {
                    user: "user1",
                    content: {
                        text: "Hello",
                    },
                },
            ],
        ],
        postExamples: ["Test post"],
        topics: ["topic1"],
        adjectives: ["friendly"],
        clients: [Clients.DISCORD],
        plugins: ["test-plugin"],
        style: {
            all: ["style1"],
            chat: ["chat-style"],
            post: ["post-style"],
        },
    };

    it("should validate correct character configuration", () => {
        expect(() =>
            validateCharacterConfig(validCharacterConfig)
        ).not.toThrow();
    });

    it("should validate configuration with optional fields", () => {
        const configWithOptionals = {
            ...validCharacterConfig,
            id: "123e4567-e89b-12d3-a456-426614174000",
            system: "Test system",
            templates: {
                greeting: "Hello!",
            },
            knowledge: ["fact1"],
            settings: {
                secrets: {
                    key: "value",
                },
                voice: {
                    model: "test-model",
                    url: "http://example.com",
                },
            },
        };
        expect(() =>
            validateCharacterConfig(configWithOptionals)
        ).not.toThrow();
    });

    it("should throw error for missing required fields", () => {
        const invalidConfig = { ...validCharacterConfig };
        delete (invalidConfig as any).name;
        expect(() => validateCharacterConfig(invalidConfig)).toThrow();
    });

    it("should validate plugin objects in plugins array", () => {
        const configWithPluginObjects = {
            ...validCharacterConfig,
            plugins: [
                {
                    name: "test-plugin",
                    description: "Test description",
                },
            ],
        };
        expect(() =>
            validateCharacterConfig(configWithPluginObjects)
        ).not.toThrow();
    });

    it("should validate client-specific configurations", () => {
        const configWithClientConfig = {
            ...validCharacterConfig,
            clientConfig: {
                discord: {
                    shouldIgnoreBotMessages: true,
                    shouldIgnoreDirectMessages: false,
                },
                telegram: {
                    shouldIgnoreBotMessages: true,
                    shouldIgnoreDirectMessages: true,
                },
            },
        };
        expect(() =>
            validateCharacterConfig(configWithClientConfig)
        ).not.toThrow();
    });

    it("should validate twitter profile configuration", () => {
        const configWithTwitter = {
            ...validCharacterConfig,
            twitterProfile: {
                username: "testuser",
                screenName: "Test User",
                bio: "Test bio",
                nicknames: ["test"],
            },
        };
        expect(() => validateCharacterConfig(configWithTwitter)).not.toThrow();
    });

    it("should validate model endpoint override", () => {
        const configWithEndpoint = {
            ...validCharacterConfig,
            modelEndpointOverride: "custom-endpoint",
        };
        expect(() => validateCharacterConfig(configWithEndpoint)).not.toThrow();
    });

    it("should validate message examples with additional properties", () => {
        const configWithComplexMessage = {
            ...validCharacterConfig,
            messageExamples: [
                [
                    {
                        user: "user1",
                        content: {
                            text: "Hello",
                            action: "wave",
                            source: "chat",
                            url: "http://example.com",
                            inReplyTo: "123e4567-e89b-12d3-a456-426614174000",
                            attachments: ["file1"],
                            customField: "value",
                        },
                    },
                ],
            ],
        };
        expect(() =>
            validateCharacterConfig(configWithComplexMessage)
        ).not.toThrow();
    });
});
