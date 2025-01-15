[@elizaos/core v0.1.8+build.1](../index.md) / GenerationOptions

# Interface: GenerationOptions

Configuration options for generating objects with a model.

## Properties

### runtime

> **runtime**: [`IAgentRuntime`](IAgentRuntime.md)

#### Defined in

[packages/core/src/generation.ts:1753](https://github.com/JoeyKhd/eliza/blob/main/packages/core/src/generation.ts#L1753)

***

### context

> **context**: `string`

#### Defined in

[packages/core/src/generation.ts:1754](https://github.com/JoeyKhd/eliza/blob/main/packages/core/src/generation.ts#L1754)

***

### modelClass

> **modelClass**: [`ModelClass`](../enumerations/ModelClass.md)

#### Defined in

[packages/core/src/generation.ts:1755](https://github.com/JoeyKhd/eliza/blob/main/packages/core/src/generation.ts#L1755)

***

### schema?

> `optional` **schema**: `ZodType`\<`any`, `ZodTypeDef`, `any`\>

#### Defined in

[packages/core/src/generation.ts:1756](https://github.com/JoeyKhd/eliza/blob/main/packages/core/src/generation.ts#L1756)

***

### schemaName?

> `optional` **schemaName**: `string`

#### Defined in

[packages/core/src/generation.ts:1757](https://github.com/JoeyKhd/eliza/blob/main/packages/core/src/generation.ts#L1757)

***

### schemaDescription?

> `optional` **schemaDescription**: `string`

#### Defined in

[packages/core/src/generation.ts:1758](https://github.com/JoeyKhd/eliza/blob/main/packages/core/src/generation.ts#L1758)

***

### stop?

> `optional` **stop**: `string`[]

#### Defined in

[packages/core/src/generation.ts:1759](https://github.com/JoeyKhd/eliza/blob/main/packages/core/src/generation.ts#L1759)

***

### mode?

> `optional` **mode**: `"auto"` \| `"json"` \| `"tool"`

#### Defined in

[packages/core/src/generation.ts:1760](https://github.com/JoeyKhd/eliza/blob/main/packages/core/src/generation.ts#L1760)

***

### experimental\_providerMetadata?

> `optional` **experimental\_providerMetadata**: `Record`\<`string`, `unknown`\>

#### Defined in

[packages/core/src/generation.ts:1761](https://github.com/JoeyKhd/eliza/blob/main/packages/core/src/generation.ts#L1761)

***

### verifiableInference?

> `optional` **verifiableInference**: `boolean`

#### Defined in

[packages/core/src/generation.ts:1762](https://github.com/JoeyKhd/eliza/blob/main/packages/core/src/generation.ts#L1762)

***

### verifiableInferenceAdapter?

> `optional` **verifiableInferenceAdapter**: [`IVerifiableInferenceAdapter`](IVerifiableInferenceAdapter.md)

#### Defined in

[packages/core/src/generation.ts:1763](https://github.com/JoeyKhd/eliza/blob/main/packages/core/src/generation.ts#L1763)

***

### verifiableInferenceOptions?

> `optional` **verifiableInferenceOptions**: [`VerifiableInferenceOptions`](VerifiableInferenceOptions.md)

#### Defined in

[packages/core/src/generation.ts:1764](https://github.com/JoeyKhd/eliza/blob/main/packages/core/src/generation.ts#L1764)
