// Plan a set of compound actions to be taken
// Get a list of actions which are valid and plan an an array of steps to take
// If the agent cannot accomplish the goal with the available actions, let the user know whats missing
// If the agent can accomplish the goal, create an array parallel actions chains to take (if any), or a single action chain
// Handle either an array of actions or an array of arrays of actions

import {
    type Action,
    type ActionExample,
    type Content,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    type State,
    logger,
} from "@elizaos/core";

interface ActionStep {
    action: string;
    params?: any;
    parallel?: boolean;
    dependsOn?: string[];
}

interface ActionPlan {
    steps: ActionStep[];
    context: string;
}

const planAction: Action = {
    name: "PLAN",
    similes: ["SEQUENCE", "CHAIN", "EXECUTE_PLAN"],
    description: "Plans and executes a sequence of actions",

    validate: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State
    ): Promise<boolean> => {
        // Plan validation is complex - needs to validate multiple potential actions
        // We'll validate specific plans during handling instead
        return true;
    },

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: any,
        callback: HandlerCallback,
        responses: Memory[]
    ): Promise<void> => {
        try {
            // First, determine what actions are available based on current context
            const availableActions = await getValidActions(runtime, message, state);

            if (availableActions.length === 0) {
                await callback({
                    text: "No valid actions available for the current context.",
                    action: "PLAN",
                    source: message.content.source
                });
                return;
            }

            // Create action plan based on message intent
            const plan = await createActionPlan(message, availableActions, state);

            if (!plan || plan.steps.length === 0) {
                await callback({
                    text: "Couldn't create a valid action plan for this request.",
                    action: "PLAN",
                    source: message.content.source
                });
                return;
            }

            // Execute the plan
            await executePlan(runtime, message, state, plan, callback);

        } catch (error) {
            logger.error("Error in plan handler:", error);
            await callback({
                text: "There was an error executing the action plan.",
                action: "PLAN",
                source: message.content.source
            });
        }
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "DM {{user2}} about their behavior and then timeout if needed",
                    source: "discord"
                }
            },
            {
                user: "{{user3}}",
                content: {
                    text: "Executing plan:\n1. Send DM\n2. Evaluate response\n3. Apply timeout if necessary",
                    action: "PLAN"
                }
            }
        ]
    ] as ActionExample[][]
};

async function getValidActions(
    runtime: IAgentRuntime,
    message: Memory,
    state: State
): Promise<Action[]> {
    const validActions: Action[] = [];

    for (const action of runtime.actions) {
        try {
            if (await action.validate(runtime, message, state)) {
                validActions.push(action);
            }
        } catch (error) {
            logger.error(`Error validating action ${action.name}:`, error);
        }
    }

    return validActions;
}

async function createActionPlan(
    message: Memory,
    availableActions: Action[],
    state: State
): Promise<ActionPlan | null> {
    const intent = message.content.text.toLowerCase();
    const plan: ActionPlan = {
        steps: [],
        context: message.content.text
    };

    // TODO: Call generateObject with the available actions and the intent, along with the current conversation history
    


    return plan.steps.length > 0 ? plan : null;
}

async function executePlan(
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    plan: ActionPlan,
    callback: HandlerCallback
): Promise<void> {
    // First, organize steps by dependencies
    const independentSteps = plan.steps.filter(step => !step.dependsOn);
    const dependentSteps = plan.steps.filter(step => step.dependsOn);

    // Track completed steps
    const completedSteps = new Set<string>();

    // Execute independent steps
    if (independentSteps.some(step => step.parallel)) {
        // Execute parallel steps concurrently
        await Promise.all(independentSteps.map(step => 
            executeStep(runtime, message, state, step, callback)
                .then(() => completedSteps.add(step.action))
        ));
    } else {
        // Execute steps sequentially
        for (const step of independentSteps) {
            await executeStep(runtime, message, state, step, callback);
            completedSteps.add(step.action);
        }
    }

    // Execute dependent steps
    for (const step of dependentSteps) {
        if (step.dependsOn?.every(dep => completedSteps.has(dep))) {
            await executeStep(runtime, message, state, step, callback);
            completedSteps.add(step.action);
        }
    }
}

async function executeStep(
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    step: ActionStep,
    callback: HandlerCallback
): Promise<void> {
    const action = runtime.actions.find(a => a.name === step.action);
    if (!action) {
        throw new Error(`Action ${step.action} not found`);
    }

    try {
        await action.handler(
            runtime,
            message,
            state,
            step.params || {},
            callback,
            [] // No responses for plan steps
        );
    } catch (error) {
        logger.error(`Error executing step ${step.action}:`, error);
        throw error;
    }
}

export default planAction;