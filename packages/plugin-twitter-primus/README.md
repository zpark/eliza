# @elizaos/plugin-twitter-primus

A plugin for Twitter/X integration, providing automated tweet posting capabilities with character-aware content generation.

## Overview

This plugin provides functionality to:

- Compose context-aware tweets
- Post tweets to Twitter/X platform
- Handle authentication and session management
- Support premium Twitter features
- Manage tweet length restrictions

## Installation

```bash
npm install @elizaos/plugin-twitter-primus
```

## Configuration

The plugin requires the following environment variables:

```env
TWITTER_USERNAME=your_username
TWITTER_PASSWORD=your_password
TWITTER_EMAIL=your_email              # Optional: for 2FA
TWITTER_2FA_SECRET=your_2fa_secret    # Optional: for 2FA
TWITTER_PREMIUM=false                 # Optional: enables premium features
TWITTER_DRY_RUN=false                # Optional: test without posting

TWITTER_USER_ID_WANT_TO_GET_TWEET=123456677 # Must: Which user the tweet came from
```

## Usage

Import and register the plugin in your Eliza configuration:

```typescript
import { twitterPlugin } from "@elizaos/plugin-twitter-primus";

export default {
    plugins: [twitterPlugin],
    // ... other configuration
};
```

## Features

### Tweet Getting

The plugin uses context-aware templates to generate appropriate tweets:

```typescript
import { postAction } from "@elizaos/plugin-twitter-primus";

// Tweet will be composed based on context and character limits
const result = await postAction.handler(runtime, message, state);
```

### Tweet Summary


### Tweet Posting

```typescript
// Post with automatic content generation
await postAction.handler(runtime, message, state);

// Dry run mode (for testing)
process.env.TWITTER_DRY_RUN = "true";
await postAction.handler(runtime, message, state);
```

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm run test
```

### Development Mode

```bash
npm run dev
```

## Dependencies

- `@elizaos/core`: Core Eliza functionality
- `agent-twitter-client`: Twitter API client
- `@primuslabs/zktls-core-sdk`: ZK-TLS SDK provided by Primus Labs
- `tsup`: Build tool
- Other standard dependencies listed in package.json

## API Reference

### Core Interfaces

```typescript
interface TweetContent {
    text: string;
}

// Tweet Schema
const TweetSchema = z.object({
    text: z.string().describe("The text of the tweet"),
});

// Action Interface
interface Action {
    name: "POST_TWEET";
    similes: string[];
    description: string;
    validate: (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State
    ) => Promise<boolean>;
    handler: (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State
    ) => Promise<boolean>;
    examples: Array<Array<any>>;
}
```

### Plugin Methods

- `postAction.handler`: Main method for posting tweets
- `postAction.validate`: Validates Twitter credentials
- `composeTweet`: Internal method for tweet generation
- `postTweet`: Internal method for tweet posting

## Common Issues/Troubleshooting

### Issue: Authentication Failures

- **Cause**: Invalid credentials or 2FA configuration
- **Solution**: Verify credentials and 2FA setup

### Issue: Tweet Length Errors

- **Cause**: Content exceeds Twitter's character limit
- **Solution**: Enable TWITTER_PREMIUM for extended tweets or ensure content is within limits

### Issue: Rate Limiting

- **Cause**: Too many requests in short time
- **Solution**: Implement proper request throttling

## Security Best Practices

- Store credentials securely using environment variables
- Use 2FA when possible
- Implement proper error handling
- Keep dependencies updated
- Use dry run mode for testing
- Monitor Twitter API usage

## Template System

The plug-in uses a complex template system to generate a summary of tweets:

```typescript
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
```

## Future Enhancements

1. **Content Generation**

    - Advanced context awareness
    - Multi-language support
    - Style customization
    - Hashtag optimization
    - Media generation
    - Thread composition

2. **Engagement Features**

    - Auto-reply system
    - Engagement analytics
    - Follower management
    - Interaction scheduling
    - Sentiment analysis
    - Community management

3. **Tweet Management**

    - Thread management
    - Tweet scheduling
    - Content moderation
    - Archive management
    - Delete automation
    - Edit optimization

4. **Analytics Integration**

    - Performance tracking
    - Engagement metrics
    - Audience insights
    - Trend analysis
    - ROI measurement
    - Custom reporting

5. **Authentication**

    - OAuth improvements
    - Multi-account support
    - Session management
    - Rate limit handling
    - Security enhancements
    - Backup mechanisms

6. **Developer Tools**
    - Enhanced debugging
    - Testing framework
    - Documentation generator
    - Integration templates
    - Error handling
    - Logging system

We welcome community feedback and contributions to help prioritize these enhancements.

## Contributing

Contributions are welcome! Please see the [CONTRIBUTING.md](CONTRIBUTING.md) file for more information.

## Credits

This plugin integrates with and builds upon several key technologies:

- [Twitter/X API](https://developer.twitter.com/en/docs): Official Twitter platform API
- [agent-twitter-client](https://www.npmjs.com/package/agent-twitter-client): Twitter API client library
- [Zod](https://github.com/colinhacks/zod): TypeScript-first schema validation

Special thanks to:

- The Twitter/X Developer Platform team
- The agent-twitter-client maintainers for API integration tools
- The Eliza community for their contributions and feedback

For more information about Twitter/X integration capabilities:

- [Twitter API Documentation](https://developer.twitter.com/en/docs)
- [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
- [Twitter API Best Practices](https://developer.twitter.com/en/docs/twitter-api/rate-limits)

## License

This plugin is part of the Eliza project. See the main project repository for license information.
