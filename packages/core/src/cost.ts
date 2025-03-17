import { logger } from './logger';

/**
 * Token counting and cost calculation utilities for various model providers
 */

// Token counting constants
const TOKENS_PER_CHAR_ESTIMATE = 0.25; // Rough estimate: ~4 chars per token

/**
 * OpenAI pricing per 1000 tokens (in USD)
 * Source: https://openai.com/pricing
 * Last updated: March 2025
 */
export const OPENAI_PRICING = {
  // GPT-4o models
  'gpt-4o': {
    input: 0.005, // $0.005 per 1K input tokens
    output: 0.015, // $0.015 per 1K output tokens
  },
  'gpt-4o-mini': {
    input: 0.00015, // $0.00015 per 1K input tokens
    output: 0.0006, // $0.0006 per 1K output tokens
  },
  // GPT-4 Turbo models
  'gpt-4-turbo': {
    input: 0.01, // $0.01 per 1K input tokens
    output: 0.03, // $0.03 per 1K output tokens
  },
  'gpt-4-turbo-preview': {
    input: 0.01, // $0.01 per 1K input tokens
    output: 0.03, // $0.03 per 1K output tokens
  },
  // GPT-4 models
  'gpt-4': {
    input: 0.03, // $0.03 per 1K input tokens
    output: 0.06, // $0.06 per 1K output tokens
  },
  'gpt-4-32k': {
    input: 0.06, // $0.06 per 1K input tokens
    output: 0.12, // $0.12 per 1K output tokens
  },
  // GPT-3.5 Turbo models
  'gpt-3.5-turbo': {
    input: 0.0005, // $0.0005 per 1K input tokens
    output: 0.0015, // $0.0015 per 1K output tokens
  },
  'gpt-3.5-turbo-16k': {
    input: 0.001, // $0.001 per 1K input tokens
    output: 0.002, // $0.002 per 1K output tokens
  },
  // Embeddings
  'text-embedding-3-small': {
    input: 0.00002, // $0.00002 per 1K input tokens
    output: 0, // No output tokens for embeddings
  },
  'text-embedding-3-large': {
    input: 0.00013, // $0.00013 per 1K input tokens
    output: 0, // No output tokens for embeddings
  },
  'text-embedding-ada-002': {
    input: 0.0001, // $0.0001 per 1K input tokens
    output: 0, // No output tokens for embeddings
  },
};

/**
 * Anthropic pricing per 1000 tokens (in USD)
 * Source: https://www.anthropic.com/api
 * Last updated: May 2024
 */
export const ANTHROPIC_PRICING = {
  // Claude 3.7 models
  'claude-3-7-sonnet': {
    input: 0.003, // $3.00 per 1M input tokens
    output: 0.015, // $15.00 per 1M output tokens
  },
  // Claude 3.5 models
  'claude-3-5-sonnet': {
    input: 0.003, // $3.00 per 1M input tokens
    output: 0.015, // $15.00 per 1M output tokens
  },
  'claude-3-5-sonnet-latest': {
    input: 0.003, // $3.00 per 1M input tokens
    output: 0.015, // $15.00 per 1M output tokens
  },
  'claude-3-5-haiku': {
    input: 0.0008, // $0.80 per 1M input tokens
    output: 0.004, // $4.00 per 1M output tokens
  },
  'claude-3-5-haiku-latest': {
    input: 0.0008, // $0.80 per 1M input tokens
    output: 0.004, // $4.00 per 1M output tokens
  },
  // Claude 3 models
  'claude-3-opus-20240229': {
    input: 0.015, // $15.00 per 1M input tokens
    output: 0.075, // $75.00 per 1M output tokens
  },
  'claude-3-opus': {
    input: 0.015, // $15.00 per 1M input tokens
    output: 0.075, // $75.00 per 1M output tokens
  },
  'claude-3-sonnet-20240229': {
    input: 0.003, // $3.00 per 1M input tokens
    output: 0.015, // $15.00 per 1M output tokens
  },
  'claude-3-sonnet': {
    input: 0.003, // $3.00 per 1M input tokens
    output: 0.015, // $15.00 per 1M output tokens
  },
  'claude-3-haiku-20240307': {
    input: 0.00025, // $0.25 per 1M input tokens
    output: 0.00125, // $1.25 per 1M output tokens
  },
  'claude-3-haiku': {
    input: 0.00025, // $0.25 per 1M input tokens
    output: 0.00125, // $1.25 per 1M output tokens
  },
  // Claude 2 models
  'claude-2': {
    input: 0.008, // $0.008 per 1K input tokens
    output: 0.024, // $0.024 per 1K output tokens
  },
  'claude-2.0': {
    input: 0.008, // $0.008 per 1K input tokens
    output: 0.024, // $0.024 per 1K output tokens
  },
  'claude-2.1': {
    input: 0.008, // $0.008 per 1K input tokens
    output: 0.024, // $0.024 per 1K output tokens
  },
  // Claude Instant models
  'claude-instant-1': {
    input: 0.0008, // $0.0008 per 1K input tokens
    output: 0.0024, // $0.0024 per 1K output tokens
  },
  'claude-instant-1.2': {
    input: 0.0008, // $0.0008 per 1K input tokens
    output: 0.0024, // $0.0024 per 1K output tokens
  },
};

/**
 * Model pricing information
 */
export interface ModelPricing {
  input: number; // Cost per 1K input tokens
  output: number; // Cost per 1K output tokens
}

/**
 * Token usage information
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/**
 * Cost calculation result
 */
export interface CostResult {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string; // Default: 'USD'
}

/**
 * Estimates token count from text using a character-based approximation
 * This is a fallback method when more accurate counting is not available
 *
 * @param text The text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length * TOKENS_PER_CHAR_ESTIMATE);
}

/**
 * Gets the pricing information for an OpenAI model
 *
 * @param modelName The name of the OpenAI model
 * @returns Pricing information or undefined if not found
 */
export function getOpenAIPricing(modelName: string): ModelPricing | undefined {
  // Try exact match first
  let pricing = OPENAI_PRICING[modelName as keyof typeof OPENAI_PRICING];

  if (!pricing) {
    // Try partial match (for models with version suffixes)
    const baseModelName = Object.keys(OPENAI_PRICING).find(
      (key) => modelName.startsWith(key) || modelName.includes(key)
    );

    if (baseModelName) {
      pricing = OPENAI_PRICING[baseModelName as keyof typeof OPENAI_PRICING];
    }
  }

  return pricing;
}

/**
 * Gets the pricing information for an Anthropic model
 *
 * @param modelName The name of the Anthropic model
 * @returns Pricing information or undefined if not found
 */
export function getAnthropicPricing(modelName: string): ModelPricing | undefined {
  // Try exact match first
  let pricing = ANTHROPIC_PRICING[modelName as keyof typeof ANTHROPIC_PRICING];

  if (!pricing) {
    // Try partial match (for models with version suffixes)
    const baseModelName = Object.keys(ANTHROPIC_PRICING).find(
      (key) => modelName.startsWith(key) || modelName.includes(key)
    );

    if (baseModelName) {
      pricing = ANTHROPIC_PRICING[baseModelName as keyof typeof ANTHROPIC_PRICING];
    }
  }

  return pricing;
}

/**
 * Calculates the cost for a model call based on token usage and pricing
 *
 * @param tokenUsage Token usage information
 * @param pricing Model pricing information
 * @param currency Currency for the cost calculation (default: 'USD')
 * @returns Cost calculation result
 */
export function calculateCost(
  tokenUsage: TokenUsage,
  pricing: ModelPricing,
  currency: string = 'USD'
): CostResult {
  const inputCost = (tokenUsage.inputTokens / 1000) * pricing.input;
  const outputCost = (tokenUsage.outputTokens / 1000) * pricing.output;
  const totalCost = inputCost + outputCost;

  return {
    inputCost,
    outputCost,
    totalCost,
    currency,
  };
}

/**
 * Gets model pricing based on provider and model name
 *
 * @param provider The model provider (e.g., 'openai', 'anthropic')
 * @param modelName The name of the model
 * @returns Pricing information or undefined if not found
 */
export function getModelPricing(provider: string, modelName: string): ModelPricing | undefined {
  switch (provider.toLowerCase()) {
    case 'openai':
      return getOpenAIPricing(modelName);
    case 'anthropic':
      return getAnthropicPricing(modelName);
    default:
      logger.warn(`Unknown model provider: ${provider}`);
      return undefined;
  }
}

/**
 * Formats a cost value to a readable string with currency
 *
 * @param cost The cost value
 * @param currency The currency code (default: 'USD')
 * @returns Formatted cost string
 */
export function formatCost(cost: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  }).format(cost);
}
