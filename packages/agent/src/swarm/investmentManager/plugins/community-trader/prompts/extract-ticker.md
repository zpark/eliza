Identify cryptocurrency ticker symbols explicitly mentioned in the conversation. Grab only the most recent ticker symbol mentioned.

Consider:

- 3-5 character uppercase abbreviations (e.g., BTC, ETH)
- Case variations (solana/SOL, matic/MATIC)
- $ prefix variations ($BTC vs BTC)

Ignore:

- Non-ticker mentions of blockchain/protocol names
- Ambiguous abbreviations that could match multiple tokens

Conversation:
<messages>
{{message}}
</messages>

Respond ONLY with XML in this exact format:

<ticker>ABC</ticker>

Example valid responses:
<ticker>SOL</ticker>

<ticker>BTC</ticker>

Now extract the tickers from the conversation.
