import {
    type Action,
    type ActionExample,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    ModelClass,
    type State,
    composeContext,
    generateObject,
    generateObjectArray,
    logger
} from "@elizaos/core";
import { type Message, ChannelType } from "discord.js";
import { type OnboardingState } from "./types";
import { findServerForOwner } from "./ownership";

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

const onboardingAction: Action = {
    name: "SAVE_SETTING",
    similes: ["UPDATE_SETTING", "SET_CONFIGURATION", "CONFIGURE"],
    description: "Saves a setting during the onboarding process",

    validate: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State
    ): Promise<boolean> => {
        console.log("*** validating onboarding action");
        if(!state?.discordMessage) {
            console.log("*** no discord message found");
            return false;
        }
        const discordMessage = state.discordMessage as Message;
        
        if (discordMessage.channel.type !== ChannelType.DM) {
            console.log("*** channel type not dm");
            return false;
        }
    
        const userId = discordMessage.author.id;

        try {
            // First check if there's an active onboarding session
            const ownershipState = await runtime.cacheManager.get<{ servers: { [key: string]: { ownerId: string } } }>(
                'server_ownership_state'
            );

            if (!ownershipState?.servers) {
                console.log("*** no ownership state found");
                return false;
            }

            // Find the server where this user is the owner
            const serverEntry = Object.entries(ownershipState.servers)
                .find(([_, info]) => info.ownerId === userId);

            if (!serverEntry) {
                console.log("*** user is not owner of any server");
                return false;
            }

            const [targetServerId] = serverEntry;

            // Check if there's an active onboarding state
            const onboardingState = await runtime.cacheManager.get<OnboardingState>(
                `server_${targetServerId}_onboarding_state`
            );

            console.log("*** action onboardingState", onboardingState);

            if (!onboardingState) {
                console.log("*** no onboarding state found");
                return false;
            }
            
            console.log("*** found active onboarding for server", targetServerId);
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
        console.log("*** handling onboarding action");

        if(!state?.discordMessage) {
            console.log("*** no discord message in state");
            return;
        }
        const discordMessage = state.discordMessage as Message;
        const userId = discordMessage.author.id;
        console.log("*** userId", userId);

        const serverOwnership = await findServerForOwner(runtime, userId, state);

        if (!serverOwnership) {
            console.log("*** no serverOwnership state found");
            return;
        }

        const serverId = serverOwnership.serverId;
        const onboardingState = await runtime.cacheManager.get<OnboardingState>(
            `server_${serverId}_onboarding_state`
        );

        if (!onboardingState) {
            console.log("*** no onboarding state found");
            return;
        }

        try {
            const { requiredUnconfigured } = categorizeSettings(onboardingState);
            
            if (requiredUnconfigured.length === 0) {
                await callback({
                    text: "All required settings have been configured.\n\n" + formatSettingsList(onboardingState),
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
            console.log("*** context", context);
            const extractedSettings = await generateObjectArray({
                runtime: runtime,
                modelClass: ModelClass.TEXT_LARGE,
                context: context,
            }) as SettingUpdate[];

            console.log("*** extractedSettings", extractedSettings);

            let updatedAny = false;
            let responseText = "";

            for (const update of extractedSettings) {
                console.log("*** update", update);
                const setting = onboardingState[update.key];
                if (!setting) {
                    console.log(`*** unknown setting key: ${update.key}`);
                    continue;
                }

                console.log("*** setting", setting);
                if (setting.validation && !setting.validation(update.value)) {
                    responseText += `❌ Invalid value for ${setting.name}: ${update.value}\n`;
                    continue;
                }

                onboardingState[update.key].value = update.value;
                responseText += `✓ Saved ${setting.name}: ${update.value}\n`;
                updatedAny = true;
            }

            console.log("*** updatedAny", updatedAny);

            if (updatedAny) {
                console.log("*** updating onboarding state");
                await runtime.cacheManager.set(
                    `server_${serverId}_onboarding_state`,
                    onboardingState
                );

                console.log("*** formatting settings list");
                responseText += `\n${formatSettingsList(onboardingState)}`;

                await callback({
                    text: responseText,
                    action: "SAVE_SETTING",
                    source: "discord"
                });

                console.log("*** logging updates");
                // Log updates
                for (const update of extractedSettings) {
                    await runtime.databaseAdapter.log({
                        body: {
                            type: "setting_update",
                            setting: update.key,
                            serverId: serverId,
                            updatedBy: userId
                        },
                        userId: runtime.agentId,
                        roomId: message.roomId,
                        type: "onboarding"
                    });
                }
            } else {
                console.log("*** could not extract any valid settings from your message");
                await callback({
                    text: "Could not extract any valid settings from your message. Please try again.\n\n" + formatSettingsList(onboardingState),
                    action: "SAVE_SETTING_FAILED",
                    source: "discord"
                });
            }

        } catch (error) {
            logger.error("Error in onboarding handler:", error);
            await callback({
                text: "There was an error saving your settings.",
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
                    text: "✓ Saved Twitter Username: techguru\n✓ Saved Twitter Email: tech@example.com\n\nCurrent Settings:\nConfigured Settings:\n- Twitter Username: techguru\n- Twitter Email: tech@example.com\n\nRequired Settings (Not Yet Configured):\n- Twitter Password: Your Twitter password",
                    action: "SAVE_SETTING"
                }
            }
        ]
    ] as ActionExample[][]
};

export default onboardingAction;