import {
    type IAgentRuntime,
    type Memory,
    type State,
    type Evaluator,
    type ActionExample,
    ModelClass,
    composeContext,
    type HandlerCallback,
    logger,
} from "@elizaos/core";

const REFLECTION_TEMPLATE = `
As {{agentName}}, reflect on my recent social behavior in this conversation:

My role and purpose:
{{bio}}

My system instructions:
{{system}}

Recent conversation:
{{recentMessages}}

Consider:
1. Am I staying true to my role and purpose?
2. Have I been speaking too much or dominating conversations?
3. Have users expressed any frustration or asked me to be quiet?
4. Am I engaging at appropriate times or interjecting unnecessarily?

Express my reflection in first person, for example:
"I sense I may be speaking too frequently..."
"The conversation is flowing naturally with my current engagement level..."
"I notice some frustration from users - I should step back..."
"I've been asked to participate here, so I feel confident engaging..."

Reflect honestly but briefly.`;

interface ReflectionState {
    monologue: string;
    lastMessageId: string;
    timestamp: number;
}

const socialAwarenessEvaluator: Evaluator = {
    name: "EVALUATE_SOCIAL_AWARENESS",
    description: "Evaluates the agent's social awareness and behavior in the conversation",
    similes: [
        "CHECK_SOCIAL_BEHAVIOR",
        "REFLECT_ON_INTERACTION",
        "ASSESS_CONVERSATION_ROLE"
    ],
    alwaysRun: true,

    examples: [
        {
            context: "The agent has been very active in the conversation, possibly too much",
            messages: [
                {
                    user: "{{user1}}",
                    content: {
                        text: "Can we focus on the task?",
                        source: "discord"
                    }
                },
                {
                    user: "{{user2}}",
                    content: {
                        text: "*steps back to observe more and speak less*",
                        action: "EVALUATE_SOCIAL_AWARENESS"
                    }
                }
            ],
            outcome: "Agent recognized over-participation and adjusted behavior"
        },
        {
            context: "The agent is participating appropriately when directly addressed",
            messages: [
                {
                    user: "{{user1}}",
                    content: {
                        text: "What do you think about this?",
                        source: "discord"
                    }
                },
                {
                    user: "{{user2}}",
                    content: {
                        text: "*maintains current engagement level as it feels appropriate*",
                        action: "EVALUATE_SOCIAL_AWARENESS"
                    }
                }
            ],
            outcome: "Agent maintained appropriate engagement level"
        }
    ] as { context: string; messages: ActionExample[]; outcome: string; }[],

    validate: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State
    ): Promise<boolean> => {
        // Only run when the agent is about to respond
        if (!message.content?.text) {
            return false;
        }

        // Check if this is a message the agent is sending
        return message.userId === runtime.agentId;
    },

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: any,
        callback: HandlerCallback
    ): Promise<void> => {
        const serverId = state.roomId;
        
        try {
            // Generate reflection using composed context
            const reflectionContext = composeContext({
                state,
                template: REFLECTION_TEMPLATE
            });

            const reflection = await runtime.useModel(
                ModelClass.TEXT_SMALL,
                reflectionContext
            );

            // Save reflection state
            const reflectionState: ReflectionState = {
                monologue: reflection,
                lastMessageId: message.id,
                timestamp: Date.now()
            };

            await runtime.cacheManager.set(
                `server_${serverId}_reflection_state`,
                reflectionState
            );

        } catch (error) {
            logger.error("Error in social awareness evaluator:", error);
        }
    }
};

export default socialAwarenessEvaluator;