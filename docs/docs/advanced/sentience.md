---
sidebar_position: 18
---

# 🪪 Sentience API

## Overview

Eliza enables developers to build autonomous, fully on-chain verifiable AI agents using [Galadriel](https://docs.galadriel.com/)'s Sentience API. Fully OpenAI-compatible.

The Sentience API leverages a Trusted Execution Environment (TEE) architecture to securely execute LLM API calls, ensuring verifiability through cryptographic attestations, with each attestation posted on-chain on Solana for transparency and integrity.

The API also enables logging functionality to retrieve and display verified inferences making it easy to implement a proof terminal like [this](https://www.daige.ai/proof).

## Background

The API supports OpenAI models (including fine-tuned models).

Using the Sentience API for inference in your agents enables you to prove the thoughts, actions, and outputs your agent does. 

How it works on a high level:
- Code gets packed into a TEE
- TEE starts and generates a private key
- AWS signs the TEE attestation
- Get LLM proofs
  - Each LLM inference request and response is hashed
  - The generated hash is signed with the TEE's private key
  - Inference response includes the `hash`, `signature`, `attestation` and `public_key`

## Tutorial

1. **Configure the environment variables**

    ```env
    GALADRIEL_API_KEY=gal-*         # Get from https://dashboard.galadriel.com/
    # Use any model supported by OpenAI
    SMALL_GALADRIEL_MODEL=          # Default: gpt-4o-mini
    MEDIUM_GALADRIEL_MODEL=         # Default: gpt-4o
    LARGE_GALADRIEL_MODEL=          # Default: gpt-4o
    # If you wish to use a fine-tuned model you will need to provide your own OpenAI API key
    GALADRIEL_FINE_TUNE_API_KEY=    # starting with sk-
    ```

2. **Configure your character to use galadriel**

    In your character file set the `modelProvider` as `galadriel`
    ```json
    "modelProvider": "galadriel"
    ```

3. **Run your agent**
4. **Get the history of all of your verified inference calls**
    ```javascript
    const url = 'https://api.galadriel.com/v1/verified/chat/completions?limit=100&filter=mine';
    const headers = {
    'accept': 'application/json',
    'Authorization': 'Bearer <GALADRIEL_API_KEY>' // Replace with your Galadriel API key
    };
    
    const response = await fetch(url, { method: 'GET', headers });
    const data = await response.json();
    console.log(data);
    ```
5. **Check your inferences in the explorer**
   
    You can also see your inferences with proofs in the [Galadriel explorer](https://explorer.galadriel.com/)
    
    And for specific responses: `https://explorer.galadriel.com/details/<hash>`
