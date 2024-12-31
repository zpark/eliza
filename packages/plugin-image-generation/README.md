# @elizaos/plugin-image-generation

Image generation plugin for Eliza OS that supports multiple AI image generation providers.

## Features

- Multi-provider support (OpenAI, Together AI, Heurist, FAL AI, Venice AI, Livepeer)
- Intelligent prompt enhancement
- Customizable image parameters
- Automatic image saving and management
- Support for various image formats and sizes
- Fallback provider chain for reliability

## Installation

```bash
pnpm install @elizaos/plugin-image-generation
```

## Configuration

The plugin requires at least one of the following API keys:

```env
ANTHROPIC_API_KEY=your-anthropic-key
TOGETHER_API_KEY=your-together-key
HEURIST_API_KEY=your-heurist-key
FAL_API_KEY=your-fal-key
OPENAI_API_KEY=your-openai-key
VENICE_API_KEY=your-venice-key
LIVEPEER_GATEWAY_URL=your-livepeer-url
```

## Usage

### Basic Image Generation

```typescript
import { imageGenerationPlugin } from '@elizaos/plugin-image-generation';

// Generate an image
const result = await eliza.execute({
  action: 'GENERATE_IMAGE',
  content: 'A serene landscape with mountains'
});
```

### Advanced Options

```typescript
const result = await eliza.execute({
  action: 'GENERATE_IMAGE',
  content: 'A futuristic cityscape',
  options: {
    width: 1024,
    height: 1024,
    count: 2,
    negativePrompt: 'blurry, low quality',
    numIterations: 50,
    guidanceScale: 7.5,
    seed: 12345
  }
});
```

## Supported Image Parameters

- `width`: Image width (default: 1024)
- `height`: Image height (default: 1024)
- `count`: Number of images to generate
- `negativePrompt`: What to avoid in the generation
- `numIterations`: Number of diffusion steps
- `guidanceScale`: How closely to follow the prompt
- `seed`: For reproducible results
- `modelId`: Specific model to use
- `stylePreset`: Visual style to apply
- `hideWatermark`: Toggle watermark visibility

## Common Issues & Troubleshooting

1. **API Key Validation**
   - Ensure at least one provider API key is configured
   - Check API key validity and quotas

2. **Image Generation Failures**
   - Verify prompt length and content
   - Check provider service status
   - Confirm supported image dimensions

3. **File System Issues**
   - Ensure write permissions for generatedImages directory
   - Check available disk space
   - Verify file path accessibility

## Security Best Practices

1. **API Key Management**
   - Store keys in environment variables
   - Never commit API keys to version control
   - Rotate keys periodically

2. **Content Safety**
   - Implement content filtering
   - Use provider safety settings
   - Monitor generated content

3. **File System Security**
   - Sanitize filenames
   - Limit access to generated files
   - Regular cleanup of temporary files

## Dependencies

- @elizaos/core: workspace:*
- tsup: 8.3.5

## Contributing

Contributions are welcome! Please see the [CONTRIBUTING.md](CONTRIBUTING.md) file for more information.

## Credits

This plugin integrates with and builds upon several key technologies:

- [OpenAI DALL-E](https://openai.com/dall-e-3): Advanced image generation model
- [Together AI](https://www.together.ai/): AI model deployment platform
- [FAL AI](https://fal.ai/): Serverless AI infrastructure
- [Heurist](https://heurist.ai/): AI model optimization
- [Venice AI](https://venice.ai/): Image generation platform
- [Livepeer](https://livepeer.org/): Decentralized video infrastructure

Special thanks to:
- The OpenAI team for DALL-E technology
- The Together AI team for model deployment tools
- The FAL AI team for serverless infrastructure
- The Heurist team for optimization capabilities
- The Venice AI and Livepeer teams
- The Eliza community for their contributions and feedback

For more information about image generation capabilities:
- [DALL-E API Documentation](https://platform.openai.com/docs/guides/images)
- [Together AI Documentation](https://docs.together.ai/)
- [FAL AI Documentation](https://fal.ai/docs)
- [Heurist Documentation](https://docs.heurist.ai/)
- [Venice AI Platform](https://docs.venice.ai/)

## License

This plugin is part of the Eliza project. See the main project repository for license information.

