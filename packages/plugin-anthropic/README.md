# Anthropic Plugin

This plugin provides a way to use Anthropic's models.

## Usage

add the plugin to your character

```json
"plugins": ["@elizaos/plugin-anthropic"]
```

## Configuration

The plugin requires an Anthropic API key. You can set it in the `ANTHROPIC_API_KEY` environment variable or directly in the character settings.

```json
"settings": {
  "ANTHROPIC_API_KEY": "your_anthropic_api_key"
}
```
or in the `.env` file

```
ANTHROPIC_API_KEY=your_anthropic_api_key
```

### This readme is to be updated!