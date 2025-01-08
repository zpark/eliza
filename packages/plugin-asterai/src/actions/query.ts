import {
    elizaLogger,
    type Action,
    type ActionExample,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    type State,
} from "@elizaos/core";
import { validateAsteraiConfig } from "../environment";
import {AsteraiClient} from "@asterai/client";

let asteraiClient: AsteraiClient | null = null;

export const queryAction = {
    name: "QUERY_ASTERAI_AGENT",
    similes: [
        "MESSAGE_ASTERAI_AGENT",
        "TALK_TO_ASTERAI_AGENT",
        "SEND_MESSAGE_TO_ASTERAI_AGENT",
        "COMMUNICATE_WITH_ASTERAI_AGENT",
    ],
    description:
        "Call this action to send a message to the asterai agent which " +
        "has access to external plugins and functionality to answer " +
        "the user you are assisting, to help perform a workflow task, etc.",
    validate: async (runtime: IAgentRuntime, _message: Memory) => {
        const config = await validateAsteraiConfig(runtime);
        if (!asteraiClient) {
            asteraiClient = new AsteraiClient({
                appId: config.ASTERAI_AGENT_ID,
                queryKey: config.ASTERAI_PUBLIC_QUERY_KEY,
            })
        }
        return true;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        if (asteraiClient === null) {
            elizaLogger.warn("asterai client is not initialised; ignoring");
            return null;
        }
        elizaLogger.debug("called QUERY_ASTERAI_AGENT action with message:", message.content);
        const response = await asteraiClient.query({
            query: message.content.text
        });
        const textResponse = await response.text();
        callback({
            text: textResponse
        });
        return true;
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "How's the weather in LA?",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Let me check that for you, just a moment.",
                    action: "QUERY_ASTERAI_AGENT",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;
