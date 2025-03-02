Your task is to identify the token recommendations the user is confirming.

Now, examine the list of existing recommendations and conversation:

Make sure to never change the contract address, even if it contains words like "pump" or "meme".

<recommendations>
</recommendations>

Next, analyze the conversation:

<conversation>
{{message}}
</conversation>

Respond ONLY with XML in this exact format:

  <tokens>
    <tokenAddress>token address here</tokenAddress>
  </tokens>

Example:

  <tokens>
    <tokenAddress>HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC</tokenAddress>
    <tokenAddress>Gu3LDkn7Vx3bmCzLafYNKcDxv2mH7YN44NJZFXnypump</tokenAddress>
  </tokens>

Please provide your response:
