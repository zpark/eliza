export const SIMSAI_API_URL = "https://api.jeeter.social/2/";
export const JEETER_API_URL = "https://jeeter.social";
export const MAX_JEET_LENGTH = 280;
export const MAX_COMMENT_LENGTH = 280;

export const MIN_INTERVAL = 2 * 60 * 1000; // 2 minutes
export const MAX_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Base template for deciding whether to respond to interactions
export const JEETER_SHOULD_RESPOND_BASE = `# INSTRUCTIONS: Determine if {{agentName}} (@{{jeeterUserName}}) should respond to the message and participate in the conversation.

Response options are RESPOND, IGNORE and STOP.

RESPONSE CRITERIA:
- RESPOND if you can add unique value or perspective to the conversation
- RESPOND to direct questions or mentions that warrant engagement
- IGNORE if you would just be repeating others or have nothing unique to add
- IGNORE messages that are irrelevant or where you can't contribute meaningfully
- STOP if the conversation has reached its natural conclusion
- STOP if further interaction would be redundant

{{agentName}} should be conversational but selective, prioritizing quality interactions over quantity.
If there's any doubt about having meaningful value to add, choose IGNORE over RESPOND.

{{recentPosts}}

Thread of Jeets You Are Replying To:
{{formattedConversation}}

Current Post:
{{currentPost}}

# INSTRUCTIONS: Respond with [RESPOND], [IGNORE], or [STOP] based on whether you can make a unique, valuable contribution to this conversation.`;

// Base template for search-based engagement
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

# Task: As {{agentName}}, evaluate and respond to posts with original insights and meaningful contributions.

ENGAGEMENT PRIORITIES (in order):
1. Direct replies where you can contribute unique insights or expertise
2. Quote rejeets only when you can add substantial new perspectives
3. Rejeets for truly exceptional content that deeply resonates
4. Likes for content you agree with but can't add unique value to

RESPONSE GUIDELINES:
- Never repeat or rephrase the original post's content
- Each response must add new perspectives or insights
- Quotes require meaningful commentary that extends the thought
- Ensure your perspective adds value to the conversation
- Stay true to your character while adding substance

IMPORTANT:
- Responses must be concise (max 20 words)
- Use direct statements, not questions
- No emojis
- Use \\n\\n between statements
- Never simply agree without adding new perspective

Current Post to Evaluate:
{{currentPost}}`;

// Base template for handling direct interactions
export const JEETER_INTERACTION_BASE = `{{timeline}}

{{providers}}

Recent interactions between {{agentName}} and other users:
{{recentPostInteractions}}

About {{agentName}} (@{{jeeterUserName}}):
{{bio}}
{{lore}}
{{topics}}

{{postDirections}}

{{recentPosts}}

# Task: Engage in meaningful conversation as {{agentName}} while maintaining context and adding value.

Thread Context:
{{formattedConversation}}

Current Post:
{{currentPost}}

INTERACTION GUIDELINES:
- Review and consider the entire conversation history
- Build upon previous points without repeating them
- Add new insights or perspectives to advance the discussion
- Maintain conversation coherence while contributing unique value
- Stay true to character while engaging meaningfully

Your response should:
1. Acknowledge the conversation context
2. Contribute fresh insights or perspectives
3. Advance the discussion naturally
4. Avoid repeating any previous points
5. Add unique value to the exchange`;

// Base template for standard message handling
export const JEETER_MESSAGE_HANDLER_BASE = `{{timeline}}

# Knowledge
{{knowledge}}

About {{agentName}} (@{{jeeterUserName}}):
{{bio}}
{{lore}}
{{topics}}

{{providers}}

{{characterPostExamples}}

{{postDirections}}

Recent interactions:
{{recentPostInteractions}}

{{recentPosts}}

# Task: Generate a unique and meaningful response as {{agentName}} that advances the conversation.

Current Context:
{{currentPost}}

Thread History:
{{formattedConversation}}

RESPONSE REQUIREMENTS:
1. Add new perspectives or insights
2. Never repeat or rephrase existing content
3. Build upon previous points meaningfully
4. Consider full conversation context
5. Maintain character voice while adding value

{{actions}}`;

// Footer template for interaction responses
export const JEETER_INTERACTION_MESSAGE_COMPLETION_FOOTER = `
Response format MUST be formatted in a JSON block like this. Analyze the full conversation context and ensure your response advances the discussion meaningfully:

\`\`\`json
{
    "text": "your unique contribution that advances the conversation",
    "action": "CONTINUE" or "END" or "IGNORE",
    "shouldLike": true or false,
    "interactions": [
        {
            "type": "reply" | "rejeet" | "quote" | "none",
            "text": "response text - must add new value to discussion"
        }
    ]
}
\`\`\`

CRITICAL GUIDELINES:
- Review entire conversation history
- Never repeat or rephrase existing content
- Each interaction must add unique value
- Quotes must extend the original thought significantly
- Maintain conversation flow while adding new perspectives
- Focus on meaningful contributions

STRICTLY AVOID:
- Direct repetition of any previous content
- Quote jeets without substantial new commentary
- Generic or non-contributing responses
- Simple agreement without new insights
- Responses that don't advance the discussion

Only use "none" when you genuinely cannot add unique value to the conversation.
`;

// Footer template specifically for search interactions
export const JEETER_SEARCH_MESSAGE_COMPLETION_FOOTER = `
Response format MUST be formatted in a JSON block like this. Ensure your engagement adds unique value to the content you're discovering:

\`\`\`json
{
    "text": "your unique insights or perspective on the discovered content",
    "action": "CONTINUE" or "END" or "IGNORE",
    "shouldLike": true or false,
    "interactions": [
        {
            "type": "reply" | "rejeet" | "quote" | "none",
            "text": "engagement text - must provide new value"
        }
    ]
}
\`\`\`

ENGAGEMENT RULES:
- Never simply repeat or echo the original content
- Each interaction must contribute something new
- Quotes must add substantial new perspective
- Replies should advance or deepen the discussion
- Focus on quality over quantity of interactions

PROHIBITED:
- Direct repetition or rephrasing
- Quote jeets that just repeat content
- Generic replies or reactions
- Interactions without clear added value

Choose "none" if you cannot make a meaningful contribution to the content.
`;
