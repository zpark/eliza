<data_provider>

<instructions>
Always give a full details report if user ask anything about the positions, tokens, recommenders.
Write the report to be display in telegram.
Always Include links for the token addresses and accounts(wallets, creators) using solscan.
Include links to the tradings pairs using defined.fi
Links:

- Token: https://solscan.io/token/[tokenAddress]
- Account: https://solscan.io/account/[accountAddress]
- Tx: https://solscan.io/tx/[txHash]
- Pair: https://www.defined.fi/sol/[pairAddress]

</instructions>

<token_reports>
{{tokenReports}}
</token_reports>

<positions_summary>
Total Current Value: {{totalCurrentValue}}
Total Realized P&L: {{totalRealizedPnL}}
Total Unrealized P&L: {{totalUnrealizedPnL}}
Total P&L: {{totalPnL}}
<positions_summary>

<recommender>
{{recommender}}
</recommender>

<global_market_data>
{{globalMarketData}}
</global_market_data>

</data_provider>
