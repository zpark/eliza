# Character File Documentation

A character file defines the personality, behavior, and capabilities of an agent in the Eliza system. This guide explains how to create and configure character files.

## Overview

Character files are stored in the [elizaos/characters](https://github.com/elizaos/characters) repository. Each character has its own directory containing configuration and knowledge files.

## Basic Structure

A character file consists of several key components:

```json
{
  "id": "unique-character-id",
  "name": "Character Name",
  "username": "character_username",
  "modelProvider": "anthropic",
  "description": "A brief description of the character",
  "personality": {
    "traits": ["friendly", "helpful", "knowledgeable"],
    "background": "Character's backstory and context",
    "speech_style": "How the character typically communicates"
  },
  "knowledge": {
    "base_path": "./knowledge",
    "files": [
      "core_knowledge.md",
      "specialized_topics.md"
    ]
  },
  "capabilities": {
    "can_generate_images": true,
    "can_analyze_images": true,
    "memory_retention": "long"
  }
}
```

## Key Components

### Basic Information
- `id`: Unique identifier for the character
- `name`: Display name of the character
- `username`: System username for the character
- `modelProvider`: The AI model provider to use (e.g., "anthropic")
- `description`: Brief overview of the character's purpose and role

### Personality Configuration
- `traits`: Array of key personality characteristics
- `background`: Character's history and context
- `speech_style`: Guidelines for how the character should communicate

### Knowledge Management
- `base_path`: Root directory for character knowledge files
- `files`: Array of knowledge files to load
- Knowledge files can include:
  - Core knowledge (fundamental information)
  - Specialized topics
  - Historical records
  - Training data

### Capabilities
- `can_generate_images`: Boolean for image generation ability
- `can_analyze_images`: Boolean for image analysis ability
- `memory_retention`: Memory retention configuration

## Directory Structure

```
characters/
├── character-name/
│   ├── character.json
│   ├── knowledge/
│   │   ├── core_knowledge.md
│   │   └── specialized_topics.md
│   └── assets/
│       └── profile.jpg
```

## Best Practices

1. **Knowledge Organization**
   - Keep knowledge files focused and well-organized
   - Use clear file names that indicate content
   - Structure knowledge hierarchically

2. **Personality Definition**
   - Be specific about personality traits
   - Provide clear speech patterns and communication style
   - Include relevant background information

3. **Capability Configuration**
   - Only enable necessary capabilities
   - Configure memory settings based on use case
   - Document any special requirements

4. **Maintenance**
   - Regularly update knowledge files
   - Version control character configurations
   - Test changes before deployment

## Integration

To use a character in your application:

```typescript
import { Character } from '@eliza/core';

const character = new Character({
  characterPath: './characters/character-name',
  // Additional runtime configuration
});
```

## Advanced Features

### Custom Knowledge Integration
Characters can integrate with custom knowledge sources:

```typescript
{
  "knowledge": {
    "custom_providers": [
      {
        "type": "database",
        "config": {
          "connection": "connection_string",
          "query": "knowledge_query"
        }
      }
    ]
  }
}
```

### Memory Configuration
Fine-tune memory settings:

```typescript
{
  "memory": {
    "retention_period": "30d",
    "priority_topics": ["user_preferences", "key_events"],
    "forget_rules": [
      {
        "type": "time_based",
        "duration": "7d"
      }
    ]
  }
}
```

## Troubleshooting

Common issues and solutions:

1. **Knowledge Loading Failures**
   - Verify file paths are correct
   - Check file permissions
   - Validate JSON syntax

2. **Character Behavior Issues**
   - Review personality configuration
   - Check knowledge file coverage
   - Verify capability settings

3. **Integration Problems**
   - Confirm correct file structure
   - Validate all required fields
   - Check system compatibility

## Resources

- [Character Repository](https://github.com/elizaos/characters)
- [API Documentation](link-to-api-docs)
- [Developer Guide](link-to-dev-guide)
