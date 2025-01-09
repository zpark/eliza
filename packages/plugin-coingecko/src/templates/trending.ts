export const getTrendingTemplate = `Given the message, verify if it's requesting trending cryptocurrency market data.

Example valid requests:
- "What's trending in crypto?"
- "Show me hot cryptocurrencies"
- "What's popular in the crypto market?"
- "Show trending coins and NFTs"
- "What's hot in crypto right now?"

Format the response as a JSON object:
{
    "valid": boolean  // true if the message is requesting trending data
}

{{recentMessages}}

Determine if the above messages are requesting trending market data and respond with the appropriate JSON.`;