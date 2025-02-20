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
import { categorizeSettings, formatSettingsList, getOnboardingCacheKey, ONBOARDING_CACHE_KEY, type OnboardingState } from "./types";

interface SettingUpdate {
    key: string;
    value: string | boolean;
}

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
${messageCompletionFooter}`;

// Enhanced extraction template that explicitly handles multiple settings
const extractionTemplate = `# Task: Extract setting values from the conversation

# Available Settings:
{{#each settings}}
{{key}}:
  Name: {{name}}
  Description: {{description}}
  Current Value: {{value}}
  Required: {{required}}
  Validation Rules: {{#if validation}}Present{{else}}None{{/if}}
{{/each}}

# Current Settings Status:
{{settingsStatus}}

# Recent Conversation:
{{recentMessages}}

# Instructions:
1. Review the ENTIRE conversation and identify ALL values provided for settings
2. For each setting mentioned, extract:
   - The setting key (must exactly match one of the available settings above)
   - The provided value that matches the setting's description and purpose
3. Return an array of ALL setting updates found, even if mentioned earlier in the conversation

Return ONLY a JSON array of objects with 'key' and 'value' properties. Format:
[
  { "key": "SETTING_NAME", "value": "extracted value" },
  { "key": "ANOTHER_SETTING", "value": "another value" }
]

IMPORTANT: Only include settings from the Available Settings list above. Ignore any other potential settings.`;

/**
 * Extracts setting values from user message with improved handling of multiple settings
 */
async function extractSettingValues(
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    onboardingState: OnboardingState
): Promise<SettingUpdate[]> {
    try {
        // Create context with current settings status for better extraction
        const context = composeContext({
            state: {
                ...state,
                settings: Object.entries(onboardingState).map(([key, setting]) => ({
                    key,
                    ...setting
                })),
                settingsStatus: formatSettingsList(onboardingState),
            },
            template: extractionTemplate
        });

        // Generate extractions using larger model for better comprehension
        const extractions = await generateObjectArray({
            runtime,
            context,
            modelClass: ModelClass.TEXT_LARGE,
        }) as SettingUpdate[];

        logger.info(`Extracted ${extractions.length} potential setting updates`);

        // Validate each extraction against setting definitions
        const validExtractions = extractions.filter(update => {
            const setting = onboardingState[update.key];
            if (!setting) {
                logger.info(`Ignored extraction for unknown setting: ${update.key}`);
                return false;
            }

            // Validate value if validation function exists
            if (setting.validation && !setting.validation(update.value)) {
                logger.info(`Validation failed for setting ${update.key}`);
                return false;
            }

            return true;
        });

        logger.info(`Validated ${validExtractions.length} setting updates`);
        return validExtractions;
    } catch (error) {
        logger.error('Error extracting setting values:', error);
        return [];
    }
}

/**
 * Processes multiple setting updates atomically
 */
async function processSettingUpdates(
    runtime: IAgentRuntime,
    serverId: string,
    onboardingState: OnboardingState,
    updates: SettingUpdate[]
): Promise<{ updatedAny: boolean; messages: string[] }> {
    if (!updates.length) {
        return { updatedAny: false, messages: [] };
    }

    const messages: string[] = [];
    let updatedAny = false;

    try {
        // Create a copy of the state for atomic updates
        const updatedState = { ...onboardingState };

        // Process all updates
        for (const update of updates) {
            const setting = updatedState[update.key];
            if (!setting) continue;

            // Check dependencies if they exist
            if (setting.dependsOn?.length) {
                const dependenciesMet = setting.dependsOn.every(dep => 
                    updatedState[dep]?.value !== null
                );
                if (!dependenciesMet) {
                    messages.push(`Cannot update ${setting.name} - dependencies not met`);
                    continue;
                }
            }

            // Update the setting
            updatedState[update.key] = {
                ...setting,
                value: update.value
            };

            messages.push(`Updated ${setting.name} successfully`);
            updatedAny = true;

            // Execute onSetAction if defined
            if (setting.onSetAction) {
                const actionMessage = setting.onSetAction(update.value);
                if (actionMessage) {
                    messages.push(actionMessage);
                }
            }
        }

        // If any updates were made, save the entire state
        if (updatedAny) {
            const cacheKey = ONBOARDING_CACHE_KEY.SERVER_STATE(serverId);
            await runtime.cacheManager.set(cacheKey, updatedState);
            
            // Verify save
            const savedState = await runtime.cacheManager.get<OnboardingState>(cacheKey);
            if (!savedState) {
                throw new Error('Failed to verify state save');
            }
        }

        return { updatedAny, messages };
    } catch (error) {
        logger.error('Error processing setting updates:', error);
        return { 
            updatedAny: false, 
            messages: ['Error occurred while updating settings'] 
        };
    }
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
        _state: State
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
                        logger.info("Found onboarding state using fallback key");
                        
                        // Copy state to the consistent key format
                        await runtime.cacheManager.set(onboardingCacheKey, fallbackState);
                        logger.info("Copied onboarding state to consistent key format");
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
        _options: any,
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
                logger.info("All required settings configured, completing onboarding");
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
                logger.info("No settings were updated");
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

export default onboardingAction;