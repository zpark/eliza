# SGX Plugin for Eliza

The SGX Plugin for Eliza enhances the platform by providing Intel SGX attestation capabilities.

Intel SGX is part of the Intel confidential computing technology portfolio that allows businesses to take advantage of the cloud while staying in control of their data. Intel SGX protects data actively being used in the processor and memory by creating a trusted execution environment (TEE) called an enclave.

The attestation capabilities are based on [Gramine Library OS](https://github.com/gramineproject/gramine).

## Components

### Providers
- **sgxAttestationProvider**: This provider is responsible for generating SGX remote attestations within Gramine SGX environments.

## Usage

First, you need to prepare the SGX environment and install the Gramine dependencies.

Then, start eliza in SGX:

```bash
pnpm i
pnpm build

# Start default character
SGX=1 make start
# Start specific character
SGX=1 make start -- --character "character/trump.character.json"
```
