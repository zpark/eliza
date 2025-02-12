import { IAgentRuntime, Plugin, logger } from "@elizaos/core";
import { Readable } from "node:stream";
import { ModelClass } from "@elizaos/core";
import { prependWavHeader } from "./utils.ts";

function getVoiceSettings(runtime: IAgentRuntime) {
  return {
    elevenlabsApiKey:
      process.env.ELEVENLABS_XI_API_KEY ||
      runtime.getSetting("ELEVENLABS_XI_API_KEY"),
    elevenlabsVoiceId:
      process.env.ELEVENLABS_VOICE_ID ||
      runtime.getSetting("ELEVENLABS_VOICE_ID"),
    elevenlabsModel:
      process.env.ELEVENLABS_MODEL_ID ||
      runtime.getSetting("ELEVENLABS_MODEL_ID") ||
      "eleven_monolingual_v1",
    elevenlabsStability:
      process.env.ELEVENLABS_VOICE_STABILITY ||
      runtime.getSetting("ELEVENLABS_VOICE_STABILITY") ||
      "0.5",
    elevenStreamingLatency:
      process.env.ELEVENLABS_OPTIMIZE_STREAMING_LATENCY ||
      runtime.getSetting("ELEVENLABS_OPTIMIZE_STREAMING_LATENCY") ||
      "0",
    elevenlabsOutputFormat:
      process.env.ELEVENLABS_OUTPUT_FORMAT ||
      runtime.getSetting("ELEVENLABS_OUTPUT_FORMAT") ||
      "pcm_16000",
    elevenlabsVoiceSimilarity:
      process.env.ELEVENLABS_VOICE_SIMILARITY_BOOST ||
      runtime.getSetting("ELEVENLABS_VOICE_SIMILARITY_BOOST") ||
      "0.75",
    elevenlabsVoiceStyle:
      process.env.ELEVENLABS_VOICE_STYLE ||
      runtime.getSetting("ELEVENLABS_VOICE_STYLE") ||
      "0",
    elevenlabsVoiceUseSpeakerBoost:
      process.env.ELEVENLABS_VOICE_USE_SPEAKER_BOOST ||
      runtime.getSetting("ELEVENLABS_VOICE_USE_SPEAKER_BOOST") ||
      "true",
  };
}

export const elevenLabsPlugin: Plugin = {
  name: "elevenLabs",
  description: "ElevenLabs plugin",

  models: {
    [ModelClass.TEXT_TO_SPEECH]: async (
      runtime: IAgentRuntime,
      text: string | null
    ) => {
      const {
        elevenlabsApiKey,
        elevenlabsVoiceId,
        elevenlabsModel,
        elevenlabsStability,
        elevenStreamingLatency,
        elevenlabsOutputFormat,
        elevenlabsVoiceSimilarity,
        elevenlabsVoiceStyle,
        elevenlabsVoiceUseSpeakerBoost,
      } = getVoiceSettings(runtime);

      try {
        const response = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${elevenlabsVoiceId}/stream?optimize_streaming_latency=${elevenStreamingLatency}&output_format=${elevenlabsOutputFormat}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "xi-api-key": elevenlabsApiKey,
            },
            body: JSON.stringify({
              model_id: elevenlabsModel,
              text: text,
              voice_settings: {
                similarity_boost: elevenlabsVoiceSimilarity,
                stability: elevenlabsStability,
                style: elevenlabsVoiceStyle,
                use_speaker_boost: elevenlabsVoiceUseSpeakerBoost,
              },
            }),
          }
        );

        const status = response.status;
        if (status !== 200) {
          const errorBodyString = await response.text();
          const errorBody = JSON.parse(errorBodyString);

          // Check for quota exceeded error
          if (status === 401 && errorBody.detail?.status === "quota_exceeded") {
            logger.log("ElevenLabs quota exceeded");
            throw new Error("QUOTA_EXCEEDED");
          }

          throw new Error(
            `Received status ${status} from Eleven Labs API: ${errorBodyString}`
          );
        }

        if (response) {
          const webStream = ReadableStream.from(
            response.body as ReadableStream
          );
          const reader = webStream.getReader();

          const readable = new Readable({
            read() {
              reader.read().then(({ done, value }) => {
                if (done) {
                  this.push(null);
                } else {
                  this.push(value);
                }
              });
            },
          });

          if (elevenlabsOutputFormat.startsWith("pcm_")) {
            const sampleRate = Number.parseInt(
              elevenlabsOutputFormat.substring(4)
            );
            const withHeader = prependWavHeader(
              readable,
              1024 * 1024 * 100,
              sampleRate,
              1,
              16
            );
            return withHeader;
          } else {
            return readable;
          }
        } else {
          return new Readable({
            read() {},
          });
        }
      } catch (error) {}
    },
  },
};
export default elevenLabsPlugin;
