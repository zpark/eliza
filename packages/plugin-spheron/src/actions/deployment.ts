import {
    Action,
    ActionExample,
    IAgentRuntime,
    Memory,
    State,
    HandlerCallback,
    elizaLogger,
    composeContext,
    generateObject,
    ModelClass,
} from "@elizaos/core";
import { validateSpheronConfig } from "../environment";
import {
    getDeployment,
    updateDeployment,
    closeDeployment,
    startDeployment,
} from "../utils";
import { DeploymentContent } from "../types";
import { AVAILABLE_GPU_MODELS, DEPLOYMENT_CONFIGS } from "../utils/constants";
import { DEPLOYMENT_TEMPLATES } from "../utils/template";

function isDeploymentContent(content: any): content is DeploymentContent {
    elizaLogger.debug("Content for deployment operation:", content);
    if (
        typeof content.operation !== "string" ||
        !["create", "update", "close"].includes(content.operation)
    ) {
        return false;
    }

    switch (content.operation) {
        case "create":
            return (
                typeof content.template === "string" &&
                typeof content.customizations === "object"
            );
        case "update":
            return (
                typeof content.leaseId === "string" &&
                typeof content.template === "string" &&
                typeof content.customizations === "object"
            );
        case "close":
            return typeof content.leaseId === "string";
        default:
            return false;
    }
}

// Generate template descriptions dynamically
const templateDescriptions = Object.entries(DEPLOYMENT_TEMPLATES)
    .map(([key, template]) => `- ${key}: ${template.description}`)
    .join("\n");

const deploymentTemplate = `Respond with a JSON markdown block containing only the extracted values for the requested deployment operation.

Example responses for different operations:

1. Creating a new deployment:
\`\`\`json
{
    "operation": "create",
    "template": "jupyter-notebook",  // Available templates: jupyter-notebook, ollama-webui, vscode-pytorch
    "customizations": {
        "cpu": false,                // Optional: Set to true for CPU-only deployment (default: false for GPU deployment)
        "resources": {               // Optional: Custom resource requirements
            "cpu": "4",
            "memory": "8Gi",
            "gpu": "1",
            "gpu_model": "rtx4090"   // Optional: Specify GPU model (default: rtx4090)
        }
    }
}
\`\`\`

2. Updating an existing deployment:
\`\`\`json
{
    "operation": "update",
    "leaseId": "existing-lease-id",
    "template": "jupyter-notebook",
    "customizations": {
        "cpu": false,
        "resources": {
            "cpu": "4",
            "memory": "8Gi",
            "gpu": "1",
            "gpu_model": "rtx4090"
        }
    }
}
\`\`\`

3. Closing a deployment:
\`\`\`json
{
    "operation": "close",
    "leaseId": "lease-id-to-close"
}
\`\`\`

## Available Templates
${templateDescriptions}

## Available GPU Models
${AVAILABLE_GPU_MODELS.map((gpu) => `- ${gpu}`).join("\n")}

Given the recent messages, extract the following information about the requested deployment:
- Desired template name
- CPU-only requirement (if specified)
- Any customization requirements (GPU model, resources, etc.)

Respond with a JSON markdown block containing only the extracted values.`;

export default {
    name: "DEPLOYMENT_OPERATION",
    similes: [
        "CREATE_DEPLOYMENT",
        "UPDATE_DEPLOYMENT",
        "GET_DEPLOYMENT",
        "CLOSE_DEPLOYMENT",
        "DEPLOY_SERVICE",
        "MANAGE_DEPLOYMENT",
        "LAUNCH_SERVICE",
        "START_DEPLOYMENT",
        "SETUP_DEPLOYMENT",
    ],
    description:
        "MUST use this action if the user requests to create, update, or manage a deployment. The request might vary, but it will always be related to deployment operations.",
    validate: async (runtime: IAgentRuntime, _message: Memory) => {
        await validateSpheronConfig(runtime);
        return true;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ) => {
        elizaLogger.log("Starting DEPLOYMENT_OPERATION handler...");

        // Initialize or update state
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        // Compose deployment context
        const deploymentContext = composeContext({
            state,
            template: deploymentTemplate,
        });

        // Generate deployment content
        const content = await generateObject({
            runtime,
            context: deploymentContext,
            modelClass: ModelClass.SMALL,
        });

        elizaLogger.debug("Deployment content:", content);

        // Validate deployment content
        if (!isDeploymentContent(content)) {
            elizaLogger.error(
                "Invalid content for DEPLOYMENT_OPERATION action."
            );
            callback?.({
                text: "Unable to process deployment request. Invalid content provided.",
                content: { error: "Invalid deployment content" },
            });
            return false;
        }

        try {
            switch (content.operation) {
                case "create": {
                    if (
                        !content.template ||
                        !DEPLOYMENT_TEMPLATES[content.template]
                    ) {
                        throw new Error(
                            `Unsupported template: ${content.template}. Available templates are: ${Object.keys(DEPLOYMENT_TEMPLATES).join(", ")}`
                        );
                    }

                    const computeConfig = DEPLOYMENT_TEMPLATES[
                        content.template
                    ].config(content.customizations);
                    const result = await startDeployment(
                        runtime,
                        computeConfig
                    );

                    elizaLogger.log("Deployment created:", result);

                    const deploymentDetails = await getDeployment(
                        runtime,
                        result.leaseId
                    );
                    const service = Object.values(
                        deploymentDetails.services
                    )[0];

                    // Get forwarded ports information
                    const ports =
                        deploymentDetails.forwarded_ports[service.name] || [];
                    const portInfo = ports
                        .map((p) => `${p.host}:${p.externalPort}`)
                        .join(", ");

                    callback?.({
                        text: `Deployment created and ready!\nLease ID: ${result.leaseId}\n${portInfo ? `Access URLs: ${portInfo}` : ""}`,
                        content: {
                            success: true,
                            leaseId: result.leaseId,
                            details: deploymentDetails,
                            ports: ports,
                        },
                    });
                    break;
                }
                case "update": {
                    if (
                        !content.leaseId ||
                        !content.template ||
                        !content.customizations
                    ) {
                        throw new Error(
                            "Lease ID, template, and customizations are required for deployment update"
                        );
                    }
                    const computeConfig = DEPLOYMENT_TEMPLATES[
                        content.template
                    ].config(content.customizations);
                    const result = await updateDeployment(
                        runtime,
                        content.leaseId,
                        computeConfig
                    );
                    elizaLogger.log("Deployment updated:", result);

                    const deploymentDetails = await getDeployment(
                        runtime,
                        content.leaseId
                    );
                    callback?.({
                        text: `Deployment ${content.leaseId} updated successfully`,
                        content: {
                            success: true,
                            details: deploymentDetails,
                        },
                    });
                    break;
                }
                case "close": {
                    if (!content.leaseId) {
                        throw new Error(
                            "Lease ID is required for deployment closure"
                        );
                    }
                    const result = await closeDeployment(
                        runtime,
                        content.leaseId
                    );
                    elizaLogger.log("Deployment closed:", result);

                    callback?.({
                        text: `Deployment ${content.leaseId} closed successfully`,
                        content: {
                            success: true,
                            transaction: result,
                        },
                    });
                    break;
                }
            }
            return true;
        } catch (error) {
            elizaLogger.error("Deployment operation failed:", error);
            callback?.({
                text: "Deployment operation failed",
                content: {
                    error:
                        error instanceof Error
                            ? error.message
                            : "Unknown error",
                },
            });
            return false;
        }
    },
    examples: [
        // Create deployment examples with templates
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Deploy a Jupyter notebook with GPU",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Setting up your Jupyter notebook deployment with GPU support...",
                    action: "DEPLOYMENT_OPERATION",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Create a CPU-only Jupyter notebook deployment",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Setting up your CPU-only Jupyter notebook deployment...",
                    action: "DEPLOYMENT_OPERATION",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Deploy Jupyter notebook with A100 GPU and 32GB memory",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Setting up your Jupyter notebook deployment with A100 GPU and custom resources...",
                    action: "DEPLOYMENT_OPERATION",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Deploy Ollama WebUI with RTX 4090",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Setting up Ollama WebUI with RTX 4090 GPU support...",
                    action: "DEPLOYMENT_OPERATION",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Create a VS Code deployment with PyTorch and T4 GPU",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Setting up VS Code PyTorch environment with T4 GPU...",
                    action: "DEPLOYMENT_OPERATION",
                },
            },
        ],
        // Update deployment examples
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Upgrade my deployment abc123 to use an A100 GPU",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Updating deployment abc123 to use A100 GPU...",
                    action: "DEPLOYMENT_OPERATION",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Scale up the memory to 64GB for deployment xyz789",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Updating deployment resources...",
                    action: "DEPLOYMENT_OPERATION",
                },
            },
        ],
        // Close deployment examples
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Close deployment abc123",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Closing deployment abc123...",
                    action: "DEPLOYMENT_OPERATION",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Stop my Jupyter notebook deployment xyz789",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Terminating Jupyter notebook deployment xyz789...",
                    action: "DEPLOYMENT_OPERATION",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;
