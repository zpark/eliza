# TEE Log Plugin for Eliza

The TEE Log Plugin for Eliza is designed to enhance the logging capabilities of the Eliza by providing a structured way to generate, store and verify TEE (Trusted Execution Environment) logs for agents. This plugin ensures that all sensitive interactions are securely logged, providing a transparent and tamper-resistant record of all sensitive activities.

## Background

As Eliza is a fully autonomous AI agent capable of running within a TEE, we need to demonstrate to the outside world that we are indeed operating within a TEE. This allows external parties to verify that our actions are protected by the TEE and that they are autonomously executed by Eliza, without any third-party interference. Therefore, it is necessary to leverage TEE's remote attestation and establish a TEE logging mechanism to prove that these operations are entirely and autonomously performed by Eliza within the TEE.

## Requirements

Since the TEE Logging is based on the TEE, it is necessary to have a TEE enabled environment. Currently, we support Intel SGX (Gramine) and Intel TDX (dstack).
- using Intel SGX (Gramine), you need to enable the plugin-sgx in the Eliza runtime, which is enabled in SGX env automatically.
- using Intel TDX (dstack), you need to enable the plugin-tee in the Eliza runtime.

## Services

- **[TeeLogService]**: This service is responsible for generating and storing TEE logs for agents.

### Class: TeeLogService

The `TeeLogService` class implements the `ITeeLogService` interface and extends the `Service` class. It manages the logging of sensitive interactions within a Trusted Execution Environment (TEE).

#### Methods

- **getInstance()**: `TeeLogService`
  - Returns the singleton instance of the `TeeLogService`.

- **static get serviceType()**: `ServiceType`
  - Returns the service type for TEE logging.

- **async initialize(runtime: IAgentRuntime): Promise<void>**
  - Initializes the TEE log service. It checks the runtime settings to configure the TEE type and enables logging if configured.

- **async log(agentId: string, roomId: string, userId: string, type: string, content: string): Promise<boolean>**
  - Logs an interaction with the specified parameters. Returns `false` if TEE logging is not enabled.

- **async getAllAgents(): Promise<TeeAgent[]>**
  - Retrieves all agents that have been logged. Returns an empty array if TEE logging is not enabled.

- **async getAgent(agentId: string): Promise<TeeAgent | undefined>**
  - Retrieves the details of a specific agent by their ID. Returns `undefined` if TEE logging is not enabled.

- **async getLogs(query: TeeLogQuery, page: number, pageSize: number): Promise<PageQuery<TeeLog[]>>**
  - Retrieves logs based on the provided query parameters. Returns an empty result if TEE logging is not enabled.

- **async generateAttestation(userReport: string): Promise<string>**
  - Generates an attestation based on the provided user report.

### Storage

The TEE logs are stored in a SQLite database, which is located at `./data/tee_log.sqlite`. The database is automatically created when the service is initialized.

Important: You need to use the encrypted file system to store the database file in production, otherwise the database will be compromised. Since TEE only protects memory-in-use, the disk is not protected by the TEE. However, Many TEE development tools support the encrypted file system, for example, you can refer to the [Gramine Encrypted files](https://gramine.readthedocs.io/en/latest/manifest-syntax.html#encrypted-files) documentation for more information.

### Usage

To use the `TeeLogService`, ensure that the TEE environment is properly configured and initialized.

The logging isn't integrated for actions by default, you need to integrate the logging for the actions you want to log. For example, if you want to log the `Continue` action of plugin-bootstrap, you can do the following:

First, add plugin-tee-log to the dependencies of plugin-bootstrap:

```json
"@elizaos/plugin-tee-log": "workspace:*",
```

Then, add the following code to the `Continue` action:

```typescript
import {
    ServiceType,
    ITeeLogService,
} from "@elizaos/core";


// In the handler of the action
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: any,
        callback: HandlerCallback
    ) => {
        // Continue the action

        // Log the action
        const teeLogService = runtime
            .getService<ITeeLogService>(ServiceType.TEE_LOG)
            .getInstance();
        if (teeLogService.log(
                runtime.agentId,
                message.roomId,
                message.userId,
                "The type of the log, for example, Action:CONTINUE",
                "The content that you want to log"
            )
        ) {
            console.log("Logged TEE log successfully");
        }

        // Continue the action
    }
```

After configuring the logging for the action, you can run the Eliza and see the logs through the client-direct REST API. See more details in the [Client-Direct REST API](../client-direct/src/README.md) documentation.