import {
    Action,
    ActionExample,
    composeContext,
    elizaLogger,
    generateObject,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    State,
} from "@elizaos/core";
import axios from "axios";
import { z } from "zod";

const getScoreTemplate = `
Extract the following parameters for cryptocurrency price data:
- **token_address** (string): The address of the token to get the score of (e.g., "Dfh5DzRgSvvCFDoYc2ciTkMrbDfRKybA4SoFbPmApump")

Provide the values in the following JSON format:
\`\`\`json
{
    "token_address": "Dfh5DzRgSvvCFDoYc2ciTkMrbDfRKybA4SoFbPmApump"
}
\`\`\`

Example request: "What's the current score of Dfh5DzRgSvvCFDoYc2ciTkMrbDfRKybA4SoFbPmApump?"
Example response:
\`\`\`json
{
    "token_address": "Dfh5DzRgSvvCFDoYc2ciTkMrbDfRKybA4SoFbPmApump"
}
\`\`\`

Example request: "What's the current score of PEANUT bGxHNbsacaVL35pkYWae5PYQDZXSpuQb3QDyW31pump?"
Example response:
\`\`\`json
{
    "token_address": "bGxHNbsacaVL35pkYWae5PYQDZXSpuQb3QDyW31pump"
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}

Based on the conversation above, if the request is for cryptocurrency score data, extract the appropriate parameters and respond with a JSON object. If the request is not related to score data, respond with null.
`;

interface ScoreResponse {
    id: string;
    scores: {
        value: number;
        title: string;
        grades: {
            volume: number;
            littleHolders: number;
            mediumHolders: number;
            social: number;
            supplyAudit: number;
        };
        updatedAt: string;
    }[];
}

const GetScoreSchema = z.object({
    token_address: z.string(),
});

export const getScoreAction: Action = {
    name: "GET_SCORE",
    similes: ["SCORE", "RATING", "TOKEN_SCORE", "TOKEN_RANK"],
    description:
        "Use this action to get the score of a token. The score is a number between 0 and 100.",
    validate: async (_runtime: IAgentRuntime, _message: Memory) => {
        return true;
    },
    handler: async (
        _runtime: IAgentRuntime,
        _message: Memory,
        _state: State,
        _options: any,
        _callback: HandlerCallback
    ) => {
        elizaLogger.log("Starting Swipr GET_SCORE handler...");

        if (!_state) {
            _state = (await _runtime.composeState(_message)) as State;
        }
        _state = await _runtime.updateRecentMessageState(_state);

        elizaLogger.log("Composing score context...");

        const scoreContext = composeContext({
            state: _state,
            template: getScoreTemplate,
        });
        elizaLogger.log("Generating content from template...");
        const result = await generateObject({
            runtime: _runtime,
            mode: "auto",
            context: scoreContext,
            modelClass: ModelClass.LARGE,
            schema: GetScoreSchema,
        });
        const content = result.object as z.infer<typeof GetScoreSchema>;
        const tokenAddress = content.token_address;
        console.log(tokenAddress);

        const baseUrl = "https://swipr-api-prod-8d24016ec292.herokuapp.com";

        const response = await axios.get<ScoreResponse>(
            `${baseUrl}/tokens/${tokenAddress}/history`,
            {
                headers: {
                    accept: "application/json",
                },
            }
        );
        console.log(response.data);

        if (!response.data) {
            throw new Error("No data received from Swipr API");
        }

        const formattedResponse = response.data.scores.map((score) => {
            const date = new Date(score.updatedAt).toLocaleDateString();
            const grades = score.grades;

            return `
Date: ${date}
Overall Score: ${score.value} - ${score.title}

Detailed Grades:
• Volume: ${grades.volume}/5
• Little Holders: ${grades.littleHolders}/5
• Medium Holders: ${grades.mediumHolders}/5
• Social: ${grades.social}/5
• Supply Audit: ${grades.supplyAudit}/5
`;
        });

        if (formattedResponse.length === 0) {
            throw new Error(
                "Failed to format score data for the specified token"
            );
        }

        const responseText = formattedResponse.join("\n-------------------\n");
        elizaLogger.success("Score data retrieved successfully!");

        if (_callback) {
            _callback({
                text: responseText,
            });
        }
        return response;
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "What's the score for the token at address 0x1234...5678?",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "I'll check the score for that token address.",
                    action: "GET_SCORE",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Here are the scores for the token:\n\nLiquidity Score: {{dynamic}}\nVolume Score: {{dynamic}}\nOverall Score: {{dynamic}}",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Can you get me the score details for 0xabcd...ef90?",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "I'll retrieve the detailed scores for that token.",
                    action: "GET_SCORE",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Token Score Analysis:\n\nSafety Rating: {{dynamic}}\nTrading Activity: {{dynamic}}\nMarket Depth: {{dynamic}}\nComposite Score: {{dynamic}}",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;
