[@elizaos/core v0.25.9](../index.md) / GenerationOptions

# Interface: GenerationOptions

Configuration options for generating objects with a model.

## Properties

### runtime

> **runtime**: [`IAgentRuntime`](IAgentRuntime.md)

#### Defined in

[packages/core/src/generation.ts:2176](https://github.com/elizaOS/eliza/blob/main/packages/core/src/generation.ts#L2176)

***

### context

> **context**: `string`

#### Defined in

[packages/core/src/generation.ts:2177](https://github.com/elizaOS/eliza/blob/main/packages/core/src/generation.ts#L2177)

***

### modelClass

> **modelClass**: [`ModelClass`](../enumerations/ModelClass.md)

#### Defined in

[packages/core/src/generation.ts:2178](https://github.com/elizaOS/eliza/blob/main/packages/core/src/generation.ts#L2178)

***

### schema?

> `optional` **schema**: `ZodSchema`

#### Defined in

[packages/core/src/generation.ts:2179](https://github.com/elizaOS/eliza/blob/main/packages/core/src/generation.ts#L2179)

***

### schemaName?

> `optional` **schemaName**: `string`

#### Defined in

[packages/core/src/generation.ts:2180](https://github.com/elizaOS/eliza/blob/main/packages/core/src/generation.ts#L2180)

***

### schemaDescription?

> `optional` **schemaDescription**: `string`

#### Defined in

[packages/core/src/generation.ts:2181](https://github.com/elizaOS/eliza/blob/main/packages/core/src/generation.ts#L2181)

***

### stop?

> `optional` **stop**: `string`[]

#### Defined in

[packages/core/src/generation.ts:2182](https://github.com/elizaOS/eliza/blob/main/packages/core/src/generation.ts#L2182)

***

### mode?

> `optional` **mode**: `"auto"` \| `"json"` \| `"tool"`

#### Defined in

[packages/core/src/generation.ts:2183](https://github.com/elizaOS/eliza/blob/main/packages/core/src/generation.ts#L2183)

***

### experimental\_providerMetadata?

> `optional` **experimental\_providerMetadata**: `Record`\<`string`, `unknown`\>

#### Defined in

[packages/core/src/generation.ts:2184](https://github.com/elizaOS/eliza/blob/main/packages/core/src/generation.ts#L2184)
