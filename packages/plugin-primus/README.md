# @elizaos/plugin-primus

A plugin to fully verify agent activities, including LLM access, actions, and interactions with external providers, powered by Primus' zkTLS protocol.

## Overview

Here's a refined version of your text:

In the Eliza framework, an agent consists of three key components: a brain (accessing an LLM), actions (the tasks the agent performs), and perception (gathering external information from providers). To fully verify agent activities, it's essential to ensure that the agent's thoughts, actions, and external information requests are all verifiable. This plugin enables full verification of these activities.

The current plugin includes:

Verification of inference from OpenAI's LLM.
An example for verifying actions, such as posting a tweet (this can be extended to any other actions).
An example to verify that the Bitcoin price is accurately fetched from Binance (this can be extended to any other data providers).


## What we do
in general

### model：
expample

### Provider
exampe

### actions
example..


...

...
##










## Installation

> Before using the plugins, make sure to install [plugin-primus](../plugin-primus) and complete the configuration.

```bash
pnpm add @elizaos/plugin-twitter-primus
```

## Configuration

The plugin requires the following environment variables:

.env file

```env
TWITTER_USERNAME=your_username
TWITTER_PASSWORD=your_password
TWITTER_EMAIL=your_email              # Recommand: for 2FA
TWITTER_2FA_SECRET=your_2fa_secret    # Optional: for 2FA
TWITTER_PREMIUM=false                 # Optional: enables premium features
TWITTER_DRY_RUN=false                # Optional: test without posting

TWITTER_USER_ID_WANT_TO_GET_TWEET=123456677 # Must: Which user the tweet came from
```

## Usage
To use the plugin, add `@elizaos/plugin-twitter-primus` to the plugins field in your character file. Here's an example of how your character file might look after the update:

```json
{
    "name": "trump",
    "plugins": [
        "@elizaos/plugin-twitter-primus"
    ],
    //other  fields
    .....
}
```

## Run
```bash
# Run with your character file
pnpm start --characters="characters/xxx.character.json"
```

## Chat with Your Agent
```
You: Get the latest tweet and post it on my twitter.
Agent: The latest tweet has posted!
```

```
You: Post a tweet on twitter for me.
Agent: The tweet has posted!
```
Other questions with the same semantic meaning can also be asked
