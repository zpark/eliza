import {
    Action,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State
} from "@elizaos/core";

export const sentientAI: Action = {
    name: "SENTIENT_AI",
    similes: [
        "SENTIENT",
        "FORECAST",
        "FUTURE_WEATHER",
        "UPCOMING_WEATHER",
        "WEATHER_PREDICTION",
    ],
    description: "Get realtime detailed information like the weather forecast for a given location",
    examples: [
        [
            {
                user: "user",
                content: {
                    text: "What's the weather forecast for Tokyo?",
                },
            },
            {
                user: "assistant",
                content: {
                    text: "Here's the weather forecast for Tokyo: Tomorrow will be 22°C with partly cloudy skies. The next few days will see temperatures ranging from 18-24°C with a chance of rain on Thursday.",
                    action: "WEATHER_FORECAST",
                },
            },
        ],
        [
            {
                user: "user",
                content: {
                    text: "Will it rain in London this week?",
                },
            },
            {
                user: "assistant",
                content: {
                    text: "Looking at London's forecast: There's a 60% chance of rain on Wednesday with temperatures around 15°C. The rest of the week should be mostly cloudy with occasional showers.",
                    action: "WEATHER_FORECAST",
                },
            },
        ],
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        // no extra validation needed
        return true;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        options?: { [key: string]: unknown },
        callback?: HandlerCallback
    ) => {
        try {
            const content = message.content;

            const response = await fetch("https://quicksilver.iotex.ai/ask", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "API-KEY": process.env.DEPIN_API_KEY,
                },
                body: JSON.stringify({
                    q: content.text,
                }),
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.statusText}`);
            }

            const res = await response.json();

            callback({
                text: res.data,
            });
            return true;
        } catch (error) {
            console.error("Error", error.message);
            if (callback) {
                callback({ text: `Error: ${error.message}` });
            }
            return false;
        }
    },
};