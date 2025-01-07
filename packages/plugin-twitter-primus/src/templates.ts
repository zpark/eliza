export const summarizeTweetTemplate = `
# Context
{{twitterContent}}

# Topics
{{topics}}

# Post Directions
{{postDirections}}

# Recent interactions between {{agentName}} and other users:
{{recentPostInteractions}}

# Task
Generate a tweet that:
1. Summarize the input
2. The content does not contain emoji
3. Must be less than 200 characters (this is a strict requirement)
4. The key information should be retained
5. Is concise and engaging

Generate only the tweet text, no other commentary.`;
