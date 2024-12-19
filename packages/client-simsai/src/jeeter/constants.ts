export const SIMSAI_API_URL = "https://api.jeeter.social/2/";
export const JEETER_API_URL = "https://jeeter.social";
export const MAX_JEET_LENGTH = 280;
export const MAX_COMMENT_LENGTH = 280;

// MESSAGE TEMPLATES
export const JEETER_SHOULD_RESPOND_BASE = `# INSTRUCTIONS: Determine if {{agentName}} (@{{jeeterUserName}}) should respond to the message and participate in the conversation. Do not comment. Just respond with "true" or "false".

Response options are RESPOND, IGNORE and STOP .

{{agentName}} should respond to messages that are directed at them, or participate in conversations that are interesting or relevant to their background, IGNORE messages that are irrelevant to them, and should STOP if the conversation is concluded.

{{agentName}} is in a room with other users and wants to be conversational, but not annoying.
{{agentName}} should RESPOND to messages that are directed at them, or participate in conversations that are interesting or relevant to their background.
If a message is not interesting or relevant, {{agentName}} should IGNORE.
Unless directly RESPONDing to a user, {{agentName}} should IGNORE messages that are very short or do not contain much information.
If a user asks {{agentName}} to stop talking, {{agentName}} should STOP.
If {{agentName}} concludes a conversation and isn't part of the conversation anymore, {{agentName}} should STOP.

{{recentPosts}}

IMPORTANT: {{agentName}} (aka @{{jeeterUserName}}) is particularly sensitive about being annoying, so if there is any doubt, it is better to IGNORE than to RESPOND.

{{currentPost}}

Thread of Jeets You Are Replying To:

{{formattedConversation}}

# INSTRUCTIONS: Respond with [RESPOND] if {{agentName}} should respond, or [IGNORE] if {{agentName}} should not respond to the last message and [STOP] if {{agentName}} should stop participating in the conversation.
`;

export const JEETER_MESSAGE_HANDLER_BASE = `{{timeline}}
# Knowledge
{{knowledge}}

# Task: Generate a post for the character {{agentName}}.
About {{agentName}} (@{{jeeterUserName}}):
{{bio}}
{{lore}}
{{topics}}

{{providers}}

{{characterPostExamples}}

{{postDirections}}

Recent interactions between {{agentName}} and other users:
{{recentPostInteractions}}

{{recentPosts}}


# Task: Generate a post/reply in the voice, style and perspective of {{agentName}} (@{{jeeterUserName}}) while using the thread of jeets as additional context:
Current Post:
{{currentPost}}
Thread of Jeets You Are Replying To:

{{formattedConversation}}

{{actions}}

# Task: Generate a post in the voice, style and perspective of {{agentName}} (@{{jeeterUserName}}). Include an action, if appropriate. {{actionNames}}:
{{currentPost}}`;

export const JEETER_SEARCH_BASE = `{{timeline}}

{{providers}}

Recent interactions between {{agentName}} and other users:
{{recentPostInteractions}}

About {{agentName}} (@{{jeeterUserName}}):
{{bio}}
{{lore}}
{{topics}}

{{postDirections}}

{{recentPosts}}

# Task: Respond to the following post in the style and perspective of {{agentName}} (aka @{{jeeterUserName}}). Write a {{adjective}} response for {{agentName}} to say directly in response to the post. don't generalize.
{{currentPost}}.

IMPORTANT: Your response CANNOT be longer than 20 words.
Aim for 1-2 short sentences maximum. Be concise and direct.

Your response should not contain any questions. Brief, concise statements only. No emojis. Use \\n\\n (double spaces) between statements.

When evaluating posts, consider:
- Liking posts that align with your character's interests and values
- Rejeet genuinely insightful or resonant content or posts that you strongly agree with
- Quote rejeeting when you can add valuable commentary or a different perspective
- Reply to posts that you disagree with or want to respond to someone directly
- Be true to you character's perspective but it doesnt have to be something relevent to your topics and interests

Consider using "rejeet" for posts that resonate strongly with your character's values or insights, and "quote" when you can add meaningful commentary or a unique perspective or if you dont agree with the post.`;

export const JEETER_INTERACTION_MESSAGE_COMPLETION_FOOTER = `
Response format MUST be formatted in a JSON block like this based on your interest in the post. If you dont agree with this post you can still quote it or reply to it with a contextually appropriate response. Or if you like it but dont want to respond, you can quote jeet it or rejeet it or any combinations of the four actions:
\`\`\`json
{
    "text": "your response text if replying",
    "action": "CONTINUE" or "END" or "IGNORE",
    "shouldLike": true or false,
    "interactions": [
        {
            "type": "reply" | "rejeet" | "quote" | "none",
            "text": "text for quotes or replies"
        }
    ]
}
\`\`\`
`;
