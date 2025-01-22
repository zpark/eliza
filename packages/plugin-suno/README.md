@elizaos/plugin-suno

A Suno AI music generation plugin for ElizaOS that enables AI-powered music creation and audio manipulation.

OVERVIEW

The Suno plugin integrates Suno AI's powerful music generation capabilities into ElizaOS, providing a seamless way to:
- Generate music from text prompts
- Create custom music with fine-tuned parameters
- Extend existing audio tracks

Original Plugin: https://github.com/gcui-art/suno-api?tab=readme-ov-file

INSTALLATION

    npm install @elizaos/plugin-suno

QUICK START

1. Register the plugin with ElizaOS:

    import { sunoPlugin } from '@elizaos/plugin-suno';
    import { Eliza } from '@elizaos/eliza';

    const eliza = new Eliza();
    eliza.registerPlugin(sunoPlugin);

2. Configure the Suno provider with your API credentials:

    import { sunoProvider } from '@elizaos/plugin-suno';

    sunoProvider.configure({
      apiKey: 'your-suno-api-key'
    });

FEATURES

1. Generate Music
   Generate music using predefined settings and a text prompt:

    await eliza.execute('suno.generate', {
      prompt: "An upbeat electronic dance track with energetic beats"
    });

2. Custom Music Generation
   Create music with detailed control over generation parameters:

    await eliza.execute('suno.customGenerate', {
      prompt: "A melodic piano piece with soft strings",
      temperature: 0.8,
      duration: 30
    });

3. Extend Audio
   Extend existing audio tracks to create longer compositions:

    await eliza.execute('suno.extend', {
      audioFile: "path/to/audio.mp3",
      duration: 60
    });

API REFERENCE

SunoProvider Configuration
The Suno provider accepts the following configuration options:

    interface SunoConfig {
      apiKey: string;
    }

Action Parameters:

1. Generate Music
    interface GenerateMusicParams {
      prompt: string;
    }

2. Custom Generate Music
    interface CustomGenerateMusicParams {
      prompt: string;
      temperature?: number;
      duration?: number;
    }

3. Extend Audio
    interface ExtendAudioParams {
      audioFile: string;
      duration: number;
    }

ERROR HANDLING

The plugin includes built-in error handling for common scenarios:

    try {
      await eliza.execute('suno.generate', params);
    } catch (error) {
      if (error.code === 'SUNO_API_ERROR') {
        // Handle API-specific errors
      }
      // Handle other errors
    }

EXAMPLES

Creating a Complete Song:

    const result = await eliza.execute('suno.generate', {
      prompt: "Create a pop song with vocals, drums, and guitar",
      duration: 180  // 3 minutes
    });

    console.log(`Generated music file: ${result.outputPath}`);

Extending an Existing Track:

    const extended = await eliza.execute('suno.extend', {
      audioFile: "original-track.mp3",
      duration: 60  // Add 60 seconds
    });

    console.log(`Extended audio file: ${extended.outputPath}`);


LICENSE

MIT

SUPPORT

For issues and feature requests, please open an issue on our GitHub repository.

---
Built with ❤️ for ElizaOS
