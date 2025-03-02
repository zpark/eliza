import {
    composeContext,
    elizaLogger,
    generateText,
    Memory,
    ModelClass,
    ServiceType,
    State,
    UUID
} from "@elizaos/core";
import { TrustScoreDatabase } from "../db.js";
import extractLatestTicketTemplate from "../prompts/extract-latest-ticket.md";
import tokenDetailsTemplate from "../prompts/token_details.md";
import {
    extractXMLFromResponse,
    parseConfirmationResponse,
    parseTokenResponse
} from "../utils.js";

export const getTokenDetails: any = {
    name: "GET_TOKEN_DETAILS",
    description: "Gets the detailed analysis of a token",
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Are you just looking for details, or are you recommending this token?",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I am just looking for details",
                },
            },
            {
                user: "{{user1}}",
                content: {
                    text: "Ok, here are the details...",
                    action: "GET_TOKEN_DETAILS",
                },
            },
        ],
    ],
    similes: ["TOKEN_DETAILS"],

    async handler(runtime, message, state, options, callback: any) {
        if (!runtime.services.has(ServiceType.TRADING)) {
            console.log("no trading service");
            return;
        }

        const tradingService = runtime.getService(ServiceType.TRADING)!;

        const db = new TrustScoreDatabase(trustDb);
        // Get a users most recent message containing a token
        const rawMessages = await db.getMessagesByUserId(
            message.userId as UUID,
            10
        );

        if (!rawMessages.length) {
            elizaLogger.error(`No messages found for user ${message.userId}`);
            return;
        }

        const messages = rawMessages.map((m) => {
            const content =
                typeof m.content === "string"
                    ? JSON.parse(m.content)
                    : m.content;
            return `
            <message>
                <createdAt>${new Date(m.createdAt as number).toISOString()}</createdAt>
                <content>${JSON.stringify(content.text)}</content>
            </message>`;
        });

        const context = composeContext({
            state: {
                messages: messages,
            } as unknown as State,
            template: extractLatestTicketTemplate,
        });

        const text = await generateText({
            modelClass: ModelClass.SMALL,
            context,
            runtime,
        });

        const extractXML = extractXMLFromResponse(text, "token");

        let results = parseTokenResponse(extractXML);

        if (!results.tokenAddress) {
            results.tokenAddress =
                await tradingService.tokenProvider.resolveTicker(
                    "solana", // todo: extract from recommendation?
                    results.ticker
                );
        }

        if (!results.tokenAddress) {
            elizaLogger.error(`No token address found for ${results.ticker}`);
            return;
        }

        const tokenOverview =
            await tradingService.tokenProvider.getTokenOverview(
                "solana",
                results.tokenAddress
            );

        const tokenOverviewString = JSON.stringify(tokenOverview, (_, v) => {
            if (typeof v === "bigint") return v.toString();
            return v;
        });

        const tokenDetailsContext = composeContext({
            state: {
                ticker: results.ticker,
                tokenOverview: tokenOverviewString,
            } as unknown as State,
            template: tokenDetailsTemplate,
        });

        const tokenDetails = await generateText({
            modelClass: ModelClass.MEDIUM,
            runtime,
            context: tokenDetailsContext,
        });

        // Do we want to store memory here?
        const agentResponseMsg = extractXMLFromResponse(
            tokenDetails,
            "message"
        );

        const finalResponse = parseConfirmationResponse(agentResponseMsg);
        if (callback) {
            const responseMemory: Memory = {
                content: {
                    text: finalResponse,
                    inReplyTo: message.metadata.msgId
                        ? message.metadata.msgId
                        : undefined,
                },
                userId: message.userId,
                agentId: message.agentId,
                roomId: message.roomId,
                metadata: {
                    ...message.metadata,
                    action: "GET_TOKEN_DETAILS",
                },
                createdAt: Date.now() * 1000,
            };
            await callback(responseMemory);
        }

        return true;
    },
    async validate(_, message) {
        if (message.agentId === message.userId) return false;
        return true;
    },
};
