import {
    type Action,
    type ActionExample,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    ModelClass,
    type State,
    composeContext,
    generateMessageResponse,
    generateObjectArray,
    logger,
    messageCompletionFooter,
    stringToUuid,
    ChannelType
} from "@elizaos/core";
import { findServerForOwner } from "./ownership";
import type { OnboardingState } from "./types";

interface SettingUpdate {
    key: string;
    value: string;
}

const categorizeSettings = (onboardingState: OnboardingState) => {
    const configured = [];
    const requiredUnconfigured = [];
    const optionalUnconfigured = [];

    for (const [key, setting] of Object.entries(onboardingState)) {
        if (setting.value !== null) {
            configured.push({ key, ...setting });
        } else if (setting.required) {
            requiredUnconfigured.push({ key, ...setting });
        } else {
            optionalUnconfigured.push({ key, ...setting });
        }
    }

    return { configured, requiredUnconfigured, optionalUnconfigured };
};

const formatSettingsList = (settings: OnboardingState) => {
    const { configured, requiredUnconfigured, optionalUnconfigured } = categorizeSettings(settings);
    let list = "Current Settings Status:\n";

    if (configured.length > 0) {
        list += "\nConfigured Settings:\n";
        configured.forEach(setting => {
            list += `- ${setting.name}: ${setting.value}\n`;
        });
    }

    if (requiredUnconfigured.length > 0) {
        list += "\nRequired Settings (Not Yet Configured):\n";
        requiredUnconfigured.forEach(setting => {
            list += `- ${setting.name}: ${setting.description}\n`;
        });
    }

    if (optionalUnconfigured.length > 0) {
        list += "\nOptional Settings (Not Yet Configured):\n";
        optionalUnconfigured.forEach(setting => {
            list += `- ${setting.name}: ${setting.description}\n`;
        });
    }

    return list;
};

// New template for generating contextual responses
const responseTemplate = `# Task: Generate a response about the onboarding settings status
About {{agentName}}:
{{bio}}

# Current Settings Status:
{{settingsStatus}}

# Onboarding Outcome:
Status: {{outcomeStatus}}
Details: {{outcomeDetails}}

# Recent Conversation Context:
{{recentMessages}}

# Instructions: Generate a natural response that:
1. Acknowledges the current interaction and setting updates
2. Maintains {{agentName}}'s personality and tone
3. Provides clear next steps or guidance if needed
4. Stays relevant to the conversation context
5. Includes all necessary information about settings status
6. Uses appropriate emotion based on the outcome (success, failure, completion)

Write a message that {{agentName}} would send about the onboarding status. Include the appropriate action.
Available actions: SAVE_SETTING_FAILED, SAVE_SETTING_COMPLETE
` + messageCompletionFooter;

const onboardingAction: Action = {
    name: "SAVE_SETTING",
    similes: ["UPDATE_SETTING", "SET_CONFIGURATION", "CONFIGURE"],
    description: "Saves a setting during the onboarding process",

    validate: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State
    ): Promise<boolean> => {
        const room = await runtime.getRoom(message.roomId);
        if(!room) {
            throw new Error("No room found");
        }
        
        const type = room.type;
        if(type !== ChannelType.DM) {
            return false;
        }
    
        try {
            // First check if there's an active onboarding session
            const ownershipState = await runtime.cacheManager.get<{ servers: { [key: string]: { ownerId: string } } }>(
                'server_ownership_state'
            );

            if (!ownershipState?.servers) {
                return false;
            }

            // Find the server where this user is the owner
            const serverEntry = Object.entries(ownershipState.servers)
                .find(([_, info]) => stringToUuid(info.ownerId) === message.userId);

            if (!serverEntry) {
                return false;
            }

            const [targetServerId] = serverEntry;

            // Check if there's an active onboarding state
            const onboardingState = await runtime.cacheManager.get<OnboardingState>(
                `server_${targetServerId}_onboarding_state`
            );

            if (!onboardingState) {
                return false;
            }
            
            return true;

        } catch (error) {
            logger.error("Error validating onboarding action:", error);
            return false;
        }
    },

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: any,
        callback: HandlerCallback
    ): Promise<void> => {
        if(!message.content.source || message.content.source !== "discord") {
            return;
        }

        const serverOwnership = await findServerForOwner(runtime, state);

        if (!serverOwnership) {
            return;
        }

        const serverId = serverOwnership.serverId;
        const onboardingState = await runtime.cacheManager.get<OnboardingState>(
            `server_${serverId}_onboarding_state`
        );

        if (!onboardingState) {
            return;
        }

        try {
            const { requiredUnconfigured } = categorizeSettings(onboardingState);
            
            // Handle completion case
            if (requiredUnconfigured.length === 0) {
                const responseContext = composeContext({
                    state: {
                        ...state,
                        settingsStatus: formatSettingsList(onboardingState),
                        outcomeStatus: "COMPLETE",
                        outcomeDetails: "All required settings have been configured successfully."
                    },
                    template: responseTemplate,
                });

                const response = await generateMessageResponse({
                    runtime,
                    context: responseContext,
                    modelClass: ModelClass.TEXT_LARGE
                });

                await callback({
                    ...response,
                    action: "SAVE_SETTING_COMPLETE",
                    source: "discord"
                });
                return;
            }

            const extractionPrompt = `Extract setting values from the following message. Return an array of objects with 'key' and 'value' properties.

${formatSettingsList(onboardingState)}

Available Settings:
${Object.entries(onboardingState).map(([key, setting]) => `
${key}:
  Name: ${setting.name}
  Description: ${setting.description}
  Required: ${setting.required}
  Current Value: ${setting.value !== null ? setting.value : 'undefined'}
`).join('\n')}

{{recentMessages}}

Message from {{senderName}}: \`${message.content.text}\`

Extract setting values from the following message. Return an array of objects with 'key' and 'value' properties. Only set values that are present, ignore values that are not present.

Don't include any other text in your response. Only return the array of objects. Response should be an array of objects like:
[
  { "key": "SETTING_KEY", "value": "extracted value" }
]`;

            const context = composeContext({ state, template: extractionPrompt });
            const extractedSettings = await generateObjectArray({
                runtime: runtime,
                modelClass: ModelClass.TEXT_LARGE,
                context: context,
            }) as SettingUpdate[];

            let updatedAny = false;
            let updateResults: string[] = [];

            for (const update of extractedSettings) {
                const setting = onboardingState[update.key];
                if (!setting) {
                    continue;
                }

                if (setting.validation && !setting.validation(update.value)) {
                    updateResults.push(`Failed to update ${setting.name}: Invalid value "${update.value}"`);
                    continue;
                }

                onboardingState[update.key].value = update.value;
                updateResults.push(`Successfully updated ${setting.name} to "${update.value}"`);
                updatedAny = true;
            }

            if (updatedAny) {
                await runtime.cacheManager.set(
                    `server_${serverId}_onboarding_state`,
                    onboardingState
                );

                const responseContext = composeContext({
                    state: {
                        ...state,
                        settingsStatus: formatSettingsList(onboardingState),
                        outcomeStatus: "SUCCESS",
                        outcomeDetails: updateResults.join("\n")
                    },
                    template: responseTemplate,
                });

                const response = await generateMessageResponse({
                    runtime,
                    context: responseContext,
                    modelClass: ModelClass.TEXT_LARGE
                });

                await callback({
                    ...response,
                    action: "SAVE_SETTING_SUCCESS",
                    source: "discord"
                });
            } else {
                const responseContext = composeContext({
                    state: {
                        ...state,
                        settingsStatus: formatSettingsList(onboardingState),
                        outcomeStatus: "FAILED",
                        outcomeDetails: "Could not extract any valid settings from your message."
                    },
                    template: responseTemplate,
                });

                const response = await generateMessageResponse({
                    runtime,
                    context: responseContext,
                    modelClass: ModelClass.TEXT_LARGE
                });

                await callback({
                    ...response,
                    action: "SAVE_SETTING_FAILED",
                    source: "discord"
                });
            }

        } catch (error) {
            logger.error("Error in onboarding handler:", error);
            
            const responseContext = composeContext({
                state: {
                    ...state,
                    settingsStatus: formatSettingsList(onboardingState),
                    outcomeStatus: "ERROR",
                    outcomeDetails: "An error occurred while saving settings."
                },
                template: responseTemplate,
            });

            const response = await generateMessageResponse({
                runtime,
                context: responseContext,
                modelClass: ModelClass.TEXT_LARGE
            });

            await callback({
                ...response,
                action: "SAVE_SETTING_FAILED",
                source: "discord"
            });
        }
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "My Twitter username is @techguru and email is tech@example.com",
                    source: "discord"
                }
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Great! I've saved your Twitter credentials. Your username (@techguru) and email are now set up. The only thing left is your Twitter password - could you provide that for me securely in DM?",
                    action: "SAVE_SETTING_SUCCESS"
                }
            }
        ]
    ] as ActionExample[][]
};

export default onboardingAction;