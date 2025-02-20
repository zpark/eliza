// File: /swarm/shared/onboarding/action.ts
// Enhanced onboarding action with improved error handling and logging

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
    ChannelType
} from "@elizaos/core";
import { normalizeUserId } from "../ownership/core";
import { findServerForOwner } from "./ownership";
import { ONBOARDING_CACHE_KEY, type OnboardingState } from "./types";

interface SettingUpdate {
    key: string;
    value: string;
}

/**
 * Helper function to ensure consistent cache key construction
 */
function getOnboardingCacheKey(serverId: string): string {
    if (!serverId) {
        throw new Error('Server ID is required for onboarding cache key');
    }
    return `server_${serverId}_onboarding_state`;
}

/**
 * Categorizes settings based on configuration status
 */
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

/**
 * Formats the settings list for display
 */
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

// Template for generating contextual responses
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

/**
 * Enhanced onboarding action with improved state management and logging
 */
const onboardingAction: Action = {
    name: "SAVE_SETTING",
    similes: ["UPDATE_SETTING", "SET_CONFIGURATION", "CONFIGURE"],
    description: "Saves a setting during the onboarding process",

    validate: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State
    ): Promise<boolean> => {
        try {
            if (!message.userId) {
                logger.error("No user ID in message for onboarding validation");
                return false;
            }
            
            // Log the user ID for debugging
            const normalizedUserId = normalizeUserId(message.userId);
            logger.info(`Validating onboarding action for user ${message.userId} (normalized: ${normalizedUserId})`);
            
            // Validate that we're in a DM channel
            const room = await runtime.getRoom(message.roomId);
            if (!room) {
                logger.error(`No room found for ID ${message.roomId}`);
                return false;
            }
            
            if (room.type !== ChannelType.DM) {
                logger.info(`Skipping onboarding in non-DM channel (type: ${room.type})`);
                return false;
            }
            
            // Find the server where this user is the owner
            logger.info(`Looking for server where user ${message.userId} is owner`);
            const serverOwnership = await findServerForOwner(runtime, message.userId);
            if (!serverOwnership) {
                logger.error(`No server ownership found for user ${message.userId}`);
                return false;
            }
            
            logger.info(`Found server ${serverOwnership.serverId} owned by ${serverOwnership.ownerId}`);
            
            // Check if there's an active onboarding state using consistent cache key
            const onboardingCacheKey = getOnboardingCacheKey(serverOwnership.serverId);
            logger.info(`Looking for onboarding state with key: ${onboardingCacheKey}`);
            
            const onboardingState = await runtime.cacheManager.get<OnboardingState>(onboardingCacheKey);
            
            if (!onboardingState) {
                logger.error(`No onboarding state found for server ${serverOwnership.serverId} using key ${onboardingCacheKey}`);
                
                // Try fallback with direct ONBOARDING_CACHE_KEY
                const fallbackKey = ONBOARDING_CACHE_KEY.SERVER_STATE(serverOwnership.serverId);
                if (fallbackKey !== onboardingCacheKey) {
                    logger.info(`Trying fallback key: ${fallbackKey}`);
                    const fallbackState = await runtime.cacheManager.get<OnboardingState>(fallbackKey);
                    if (fallbackState) {
                        logger.info(`Found onboarding state using fallback key`);
                        
                        // Copy state to the consistent key format
                        await runtime.cacheManager.set(onboardingCacheKey, fallbackState);
                        logger.info(`Copied onboarding state to consistent key format`);
                        return true;
                    }
                }
                
                return false;
            }
            
            logger.info(`Found valid onboarding state for server ${serverOwnership.serverId}`);
            return true;
        } catch (error) {
            logger.error(`Error validating onboarding action: ${error}`);
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
        if (!message.content.source || message.content.source !== "discord") {
            logger.info(`Skipping non-discord message source: ${message.content.source}`);
            return;
        }
        
        try {
            // Find the server where this user is the owner
            logger.info(`Handler looking for server for user ${message.userId}`);
            const serverOwnership = await findServerForOwner(runtime, message.userId);
            if (!serverOwnership) {
                logger.error(`No server found for user ${message.userId} in handler`);
                await generateErrorResponse(runtime, state, callback);
                return;
            }
            
            const serverId = serverOwnership.serverId;
            logger.info(`Using server ID: ${serverId}`);
            
            // Use consistent cache key
            const onboardingCacheKey = getOnboardingCacheKey(serverId);
            logger.info(`Getting onboarding state with key: ${onboardingCacheKey}`);
            
            const onboardingState = await runtime.cacheManager.get<OnboardingState>(onboardingCacheKey);
            
            if (!onboardingState) {
                logger.error(`No onboarding state found for server ${serverId} in handler`);
                await generateErrorResponse(runtime, state, callback);
                return;
            }
            
            // Check if all required settings are already configured
            const { requiredUnconfigured } = categorizeSettings(onboardingState);
            if (requiredUnconfigured.length === 0) {
                logger.info(`All required settings configured, completing onboarding`);
                await handleOnboardingComplete(runtime, onboardingState, state, callback);
                return;
            }
            
            // Extract setting values from message
            logger.info(`Extracting settings from message: ${message.content.text}`);
            const extractedSettings = await extractSettingValues(runtime, message, state, onboardingState);
            logger.info(`Extracted ${extractedSettings.length} settings`);
            
            // Process extracted settings
            const updateResults = await processSettingUpdates(runtime, serverId, onboardingState, extractedSettings);
            
            // Generate appropriate response
            if (updateResults.updatedAny) {
                logger.info(`Successfully updated settings: ${updateResults.messages.join(', ')}`);
                await generateSuccessResponse(runtime, onboardingState, state, updateResults.messages, callback);
            } else {
                logger.info(`No settings were updated`);
                await generateFailureResponse(runtime, onboardingState, state, callback);
            }
        } catch (error) {
            logger.error(`Error in onboarding handler: ${error}`);
            await generateErrorResponse(runtime, state, callback);
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

/**
 * Extracts setting values from user message
 */
async function extractSettingValues(
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    onboardingState: OnboardingState
): Promise<SettingUpdate[]> {
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
    return await generateObjectArray({
        runtime: runtime,
        modelClass: ModelClass.TEXT_LARGE,
        context: context,
    }) as SettingUpdate[];
}

/**
 * Processes setting updates and saves valid ones
 */
async function processSettingUpdates(
    runtime: IAgentRuntime,
    serverId: string,
    onboardingState: OnboardingState,
    extractedSettings: SettingUpdate[]
): Promise<{ updatedAny: boolean, messages: string[] }> {
    let updatedAny = false;
    const updateResults: string[] = [];
    
    for (const update of extractedSettings) {
        const setting = onboardingState[update.key];
        if (!setting) {
            logger.info(`Setting key not found: ${update.key}`);
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
        // Use consistent cache key format
        const onboardingCacheKey = getOnboardingCacheKey(serverId);
        logger.info(`Saving updated onboarding state with key: ${onboardingCacheKey}`);
        
        await runtime.cacheManager.set(onboardingCacheKey, onboardingState);
        
        // Verify the save was successful
        const verifyState = await runtime.cacheManager.get<OnboardingState>(onboardingCacheKey);
        if (!verifyState) {
            logger.error(`Failed to verify onboarding state was saved`);
        } else {
            logger.info(`Verified onboarding state was saved successfully`);
            
            // Also update using the original cache key format for backwards compatibility
            const originalCacheKey = ONBOARDING_CACHE_KEY.SERVER_STATE(serverId);
            if (originalCacheKey !== onboardingCacheKey) {
                await runtime.cacheManager.set(originalCacheKey, onboardingState);
                logger.info(`Also saved to original cache key format: ${originalCacheKey}`);
            }
        }
    }
    
    return { updatedAny, messages: updateResults };
}

/**
 * Handles successful completion of all required settings
 */
async function handleOnboardingComplete(
    runtime: IAgentRuntime,
    onboardingState: OnboardingState,
    state: State,
    callback: HandlerCallback
): Promise<void> {
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
}

/**
 * Generates success response after successful setting updates
 */
async function generateSuccessResponse(
    runtime: IAgentRuntime,
    onboardingState: OnboardingState,
    state: State,
    updateResults: string[],
    callback: HandlerCallback
): Promise<void> {
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
}

/**
 * Generates failure response when no settings could be extracted
 */
async function generateFailureResponse(
    runtime: IAgentRuntime,
    onboardingState: OnboardingState,
    state: State,
    callback: HandlerCallback
): Promise<void> {
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

/**
 * Generates error response when an exception occurs
 */
async function generateErrorResponse(
    runtime: IAgentRuntime,
    state: State,
    callback: HandlerCallback
): Promise<void> {
    const responseContext = composeContext({
        state: {
            ...state,
            settingsStatus: "Error retrieving settings",
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

export default onboardingAction;