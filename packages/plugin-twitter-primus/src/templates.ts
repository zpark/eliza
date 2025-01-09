export const summarizeTweetTemplate = (twitterContent:string) => {
    return  `
    # Context
    ${twitterContent}

    # Task
    Generate a tweet that:
    1. Summarize the input
    2. The content does not contain emoji
    3. Must be less than 200 characters (this is a strict requirement)
    4. The key information should be retained
    5. Is concise and engaging

    Generate only the tweet text, no other commentary.
    Response format should be formatted in a JSON block like this:
    {"text": "string"}
    `;
};
