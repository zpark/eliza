import {
    type IAgentRuntime,
    type Memory,
    type Provider,
    type State,
    ModelClass,
    composeContext,
    logger,
} from "@elizaos/core";
import type { Message } from "discord.js";

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

export const socialAwarenessProvider: Provider = {
    get: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State
    ): Promise<string> => {
        if(!state?.discordMessage) {
            return "";
        }
        const discordMessage = state.discordMessage as Message;
        if (!discordMessage.guild?.id) {
            return "";
        }

        const serverId = discordMessage.guild.id;

        try {
            // Try to get existing reflection
            const reflectionState = await runtime.cacheManager.get<ReflectionState>(
                `server_${serverId}_reflection_state`
            );

            // If we have a recent reflection for this message, return it
            if (reflectionState?.lastMessageId === message.id) {
                return reflectionState.monologue;
            }

            // Generate new reflection
            const reflectionContext = composeContext({
                state,
                template: REFLECTION_TEMPLATE
            });

            const reflection = await runtime.useModel(
                ModelClass.TEXT_SMALL,
                reflectionContext
            );

            // Save new reflection
            const newReflectionState: ReflectionState = {
                monologue: reflection,
                lastMessageId: message.id,
                timestamp: Date.now()
            };

            await runtime.cacheManager.set(
                `server_${serverId}_reflection_state`,
                newReflectionState
            );

            return reflection;

        } catch (error) {
            logger.error("Error in social awareness provider:", error);
            return "";
        }
    }
};

export default socialAwarenessProvider;