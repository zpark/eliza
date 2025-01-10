export const getTopGainersLosersTemplate = `Given the message, extract information about the request for top gaining and losing cryptocurrencies.

Parameters to extract:
- vs_currency: The target currency (default: "usd")
- duration: Time range for price changes ("24h", "7d", "14d", "30d", "60d", "1y")
- top_coins: Filter by market cap ranking (default: "1000")

Format the response as a JSON object with these fields:
- vs_currency: string (default to "usd" if not specified)
- duration: string (default to "24h" if not specified)
- top_coins: string (default to "1000" if not specified)

Example responses:
For "Show me the biggest gainers and losers today":
\`\`\`json
{
    "vs_currency": "usd",
    "duration": "24h",
    "top_coins": "1000"
}
\`\`\`

For "What are the top movers in EUR for the past week?":
\`\`\`json
{
    "vs_currency": "eur",
    "duration": "7d",
    "top_coins": "300"
}
\`\`\`

{{recentMessages}}

Extract the parameters from the above messages and respond with the appropriate JSON.`;