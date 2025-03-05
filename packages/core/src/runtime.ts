import { join } from "node:path";
import { v4 as uuidv4 } from "uuid";
import { bootstrapPlugin } from "./bootstrap.ts";
import { settings } from "./environment.ts";
import { createUniqueUuid, handlePluginImporting, logger } from "./index.ts";
import { MemoryManager } from "./memory.ts";
import {
  splitChunks
} from "./prompts.ts";
import {
  type Action,
  type Agent,
  ChannelType,
  type Character,
  type Evaluator,
  type HandlerCallback,
  type IAgentRuntime,
  type IDatabaseAdapter,
  type IMemoryManager,
  type KnowledgeItem,
  type Memory,
  MemoryType,
  type ModelType,
  ModelTypes,
  type Plugin,
  type Provider,
  type Room,
  type Route,
  type Service,
  type ServiceType,
  type State,
  type TaskWorker,
  type UUID,
  type World,
} from "./types.ts";
import { stringToUuid } from "./uuid.ts";

/**
 * Represents the runtime environment for an agent, handling message processing,
 * action registration, and interaction with external services like OpenAI and Supabase.
 */
export class AgentRuntime implements IAgentRuntime {
  readonly #conversationLength = 32 as number;
  readonly agentId: UUID;
  readonly character: Character;
  public databaseAdapter!: IDatabaseAdapter;
  readonly actions: Action[] = [];
  readonly evaluators: Evaluator[] = [];
  readonly providers: Provider[] = [];
  readonly plugins: Plugin[] = [];
  events: Map<string, ((params: any) => void)[]> = new Map();
  stateCache = new Map<UUID, { values: State; data: any; providers: string }>();

  readonly fetch = fetch;
  services: Map<ServiceType, Service> = new Map();

  public adapters: IDatabaseAdapter[];

  private readonly knowledgeRoot: string;

  models = new Map<string, ((params: any) => Promise<any>)[]>();
  routes: Route[] = [];

  private taskWorkers = new Map<string, TaskWorker>();

  constructor(opts: {
    conversationLength?: number;
    agentId?: UUID;
    character?: Character;
    plugins?: Plugin[];
    fetch?: typeof fetch;
    databaseAdapter?: IDatabaseAdapter;
    adapters?: IDatabaseAdapter[];
    events?: { [key: string]: ((params: any) => void)[] };
    ignoreBootstrap?: boolean;
  }) {
    // use the character id if it exists, otherwise use the agentId if it is passed in, otherwise use the character name
    this.agentId =
      opts.character?.id ??
      opts?.agentId ??
      stringToUuid(opts.character?.name ?? uuidv4());
    this.character = opts.character;

    logger.debug(`[AgentRuntime] Process working directory: ${process.cwd()}`);

    this.knowledgeRoot =
      typeof process !== "undefined" && process.cwd
        ? join(process.cwd(), "..", "characters", "knowledge")
        : "./characters/knowledge";

    logger.debug(`[AgentRuntime] Process knowledgeRoot: ${this.knowledgeRoot}`);

    this.#conversationLength =
      opts.conversationLength ?? this.#conversationLength;

    if (opts.databaseAdapter) {
      this.databaseAdapter = opts.databaseAdapter;
    }

    logger.success(`Agent ID: ${this.agentId}`);

    this.fetch = (opts.fetch as typeof fetch) ?? this.fetch;

    const plugins = opts?.plugins ?? [];

    if (!opts?.ignoreBootstrap) {
      plugins.push(bootstrapPlugin);
    }

    this.plugins = plugins;

    // Initialize adapters from options or empty array if not provided
    this.adapters = opts.adapters ?? [];
  }

  getAllServices(): Map<ServiceType, Service> {
    return this.services;
  }

  async stop() {
    logger.debug(`runtime::stop - character ${this.character.name}`);

    // Stop all registered clients
    for (const [serviceName, service] of this.services) {
      logger.log(`runtime::stop - requesting service stop for ${serviceName}`);
      await service.stop();
    }
  }

  async initialize() {
    // First create the agent entity directly
    try {
      await this.databaseAdapter.ensureAgentExists(
        this.character as Partial<Agent>
      );

      // No need to transform agent's own ID
      const agentEntity = await this.databaseAdapter.getEntityById(
        this.agentId
      );

      if (!agentEntity) {
        const created = await this.databaseAdapter.createEntity({
          id: this.agentId,
          agentId: this.agentId,
          names: Array.from(
            new Set([this.character.name].filter(Boolean))
          ) as string[],
          metadata: {},
        });

        if (!created) {
          throw new Error(`Failed to create entity for agent ${this.agentId}`);
        }

        logger.success(
          `Agent entity created successfully for ${this.character.name}`
        );
      }
    } catch (error) {
      logger.error(
        `Failed to create agent entity: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }

    // Load plugins before trying to access models or services
    if (this.character.plugins) {
      const characterPlugins = (await handlePluginImporting(
        this.character.plugins
      )) as Plugin[];
      // push character plugins to this.plugins
      this.plugins.push(...characterPlugins);
    }

    if (this.plugins?.length > 0) {
      for (const plugin of this.plugins) {
        if (!plugin) {
          continue;
        }
        if (plugin.adapters) {
          for (const adapter of plugin.adapters) {
            this.adapters.push(adapter);
          }
        }

        if (plugin.actions) {
          for (const action of plugin.actions) {
            this.registerAction(action);
          }
        }

        if (plugin.evaluators) {
          for (const evaluator of plugin.evaluators) {
            this.registerEvaluator(evaluator);
          }
        }

        if (plugin.providers) {
          for (const provider of plugin.providers) {
            this.registerContextProvider(provider);
          }
        }

        if (plugin.models) {
          for (const [modelType, handler] of Object.entries(plugin.models)) {
            this.registerModel(
              modelType as ModelType,
              handler as (params: any) => Promise<any>
            );
          }
        }
        if (plugin.routes) {
          for (const route of plugin.routes) {
            this.routes.push(route);
          }
        }

        if (plugin.events) {
          for (const [eventName, eventHandlers] of Object.entries(
            plugin.events
          )) {
            for (const eventHandler of eventHandlers) {
              this.registerEvent(eventName, eventHandler);
            }
          }
        }
        if (plugin.services) {
          await Promise.all(
            plugin.services.map((service) => this.registerService(service))
          );
        }

        if (plugin.init) {
          await plugin.init(plugin.config, this);
        }
      }
    }

    // Create room for the agent
    try {
      await this.ensureRoomExists({
        id: this.agentId,
        name: this.character.name,
        source: "self",
        type: ChannelType.SELF,
      });
    } catch (error) {
      logger.error(
        `Failed to create room: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }

    // Add agent as participant in its own room
    try {
      // No need to transform agent ID
      const participants = await this.databaseAdapter.getParticipantsForRoom(
        this.agentId
      );
      if (!participants.includes(this.agentId)) {
        const added = await this.databaseAdapter.addParticipant(
          this.agentId,
          this.agentId
        );
        if (!added) {
          throw new Error(
            `Failed to add agent ${this.agentId} as participant to its own room`
          );
        }
        logger.success(
          `Agent ${this.character.name} linked to its own room successfully`
        );
      }
    } catch (error) {
      logger.error(
        `Failed to add agent as participant: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }

    // Process character knowledge
    if (this.character?.knowledge && this.character.knowledge.length > 0) {
      const stringKnowledge = this.character.knowledge.filter(
        (item): item is string => typeof item === "string"
      );
      await this.processCharacterKnowledge(stringKnowledge);
    }

    // Check if TEXT_EMBEDDING model is registered
    const embeddingModel = this.getModel(ModelTypes.TEXT_EMBEDDING);
    if (!embeddingModel) {
      logger.warn(
        `[AgentRuntime][${this.character.name}] No TEXT_EMBEDDING model registered. Skipping embedding dimension setup.`
      );
    } else {
      // Only run ensureEmbeddingDimension if we have an embedding model
      await this.ensureEmbeddingDimension();
    }
  }

  private async handleProcessingError(error: any, context: string) {
    logger.error(
      `Error ${context}:`,
      error?.message || error || "Unknown error"
    );
    throw error;
  }

  private async checkExistingKnowledge(knowledgeId: UUID): Promise<boolean> {
    const existingDocument = await this.getMemoryManager(
      "documents"
    ).getMemoryById(knowledgeId);
    return !!existingDocument;
  }

  async getKnowledge(message: Memory): Promise<KnowledgeItem[]> {
    // Add validation for message
    if (!message?.content?.text) {
      logger.warn("Invalid message for knowledge query:", {
        message,
        content: message?.content,
        text: message?.content?.text,
      });
      return [];
    }

    // Validate processed text
    if (!message?.content?.text || message?.content?.text.trim().length === 0) {
      logger.warn("Empty text for knowledge query");
      return [];
    }

    const embedding = await this.useModel(
      ModelTypes.TEXT_EMBEDDING,
      message?.content?.text
    );
    const fragments = await this.getMemoryManager("knowledge").searchMemories({
      embedding,
      roomId: message.agentId,
      count: 5,
      match_threshold: 0.1,
    });

    const uniqueSources = [
      ...new Set(
        fragments.map((memory) => {
          logger.log(
            `Matched fragment: ${memory.content.text} with similarity: ${memory.similarity}`
          );
          return memory.content.source;
        })
      ),
    ];

    const knowledgeDocuments = await Promise.all(
      uniqueSources.map((source) =>
        this.getMemoryManager("documents").getMemoryById(source as UUID)
      )
    );

    return knowledgeDocuments
      .filter((memory) => memory !== null)
      .map((memory) => ({ id: memory.id, content: memory.content }));
  }

  async addKnowledge(
    item: KnowledgeItem,
    options = {
      targetTokens: 3000,
      overlap: 200,
      modelContextSize: 4096,
    }
  ) {
    // First store the document
    const documentMemory: Memory = {
      id: item.id,
      agentId: this.agentId,
      roomId: this.agentId,
      userId: this.agentId,
      content: item.content,
      metadata: {
        type: MemoryType.DOCUMENT,
        timestamp: Date.now(),
      },
    };

    await this.getMemoryManager("documents").createMemory(documentMemory);

    // Create fragments using splitChunks
    const fragments = await splitChunks(
      item.content.text,
      options.targetTokens,
      options.overlap
    );

    // Store each fragment with link to source document
    for (let i = 0; i < fragments.length; i++) {
      const fragmentMemory: Memory = {
        id: createUniqueUuid(this, `${item.id}-fragment-${i}`),
        agentId: this.agentId,
        roomId: this.agentId,
        userId: this.agentId,
        content: { text: fragments[i] },
        metadata: {
          type: MemoryType.FRAGMENT,
          documentId: item.id, // Link to source document
          position: i, // Keep track of order
          timestamp: Date.now(),
        },
      };

      await this.getMemoryManager("knowledge").createMemory(fragmentMemory);
    }
  }

  async processCharacterKnowledge(items: string[]) {
    for (const item of items) {
      try {
        const knowledgeId = createUniqueUuid(this, item);
        if (await this.checkExistingKnowledge(knowledgeId)) {
          continue;
        }

        logger.info(
          "Processing knowledge for ",
          this.character.name,
          " - ",
          item.slice(0, 100)
        );

        await this.addKnowledge({
          id: knowledgeId,
          content: {
            text: item,
          },
        });
      } catch (error) {
        await this.handleProcessingError(
          error,
          "processing character knowledge"
        );
      }
    }
  }

  setSetting(
    key: string,
    value: string | boolean | null | any,
    secret = false
  ) {
    if (secret) {
      this.character.secrets[key] = value;
    } else {
      this.character.settings[key] = value;
    }
  }

  getSetting(key: string): string | boolean | null | any {
    const value =
      this.character.secrets?.[key] ||
      this.character.settings?.[key] ||
      this.character.settings?.secrets?.[key] ||
      settings[key];

    if (value === "true") return true;
    if (value === "false") return false;
    return value || null;
  }

  /**
   * Get the number of messages that are kept in the conversation buffer.
   * @returns The number of recent messages to be kept in memory.
   */
  getConversationLength() {
    return this.#conversationLength;
  }

  registerDatabaseAdapter(adapter: IDatabaseAdapter) {
    this.adapters.push(adapter);
  }

  getDatabaseAdapters() {
    return this.adapters;
  }

  getDatabaseAdapter() {
    return this.adapters[0];
  }

  /**
   * Register a provider for the agent to use.
   * @param provider The provider to register.
   */
  registerProvider(provider: Provider) {
    this.providers.push(provider);
  }

  /**
   * Register an action for the agent to perform.
   * @param action The action to register.
   */
  registerAction(action: Action) {
    logger.success(
      `${this.character.name}(${this.agentId}) - Registering action: ${action.name}`
    );
    this.actions.push(action);
  }

  /**
   * Register an evaluator to assess and guide the agent's responses.
   * @param evaluator The evaluator to register.
   */
  registerEvaluator(evaluator: Evaluator) {
    this.evaluators.push(evaluator);
  }

  /**
   * Register a context provider to provide context for message generation.
   * @param provider The context provider to register.
   */
  registerContextProvider(provider: Provider) {
    this.providers.push(provider);
  }

  /**
   * Process the actions of a message.
   * @param message The message to process.
   * @param responses The array of response memories to process actions from.
   * @param state Optional state object for the action processing.
   * @param callback Optional callback handler for action results.
   */
  async processActions(
    message: Memory,
    responses: Memory[],
    state?: State,
    callback?: HandlerCallback
  ): Promise<void> {
    for (const response of responses) {
      if (!response.content?.actions || response.content.actions.length === 0) {
        logger.warn("No action found in the response content.");
        continue;
      }

      const actions = response.content.actions;

      function normalizeAction(action: string) {
        return action.toLowerCase().replace("_", "");
      }
      logger.success(`Found actions: ${this.actions.map((a) => normalizeAction(a.name))}`);

      for (const responseAction of actions) {
        logger.success(`Calling action: ${responseAction}`);
        const normalizedResponseAction = normalizeAction(responseAction);
        let action = this.actions.find(
          (a: { name: string }) =>
            normalizeAction(a.name).includes(normalizedResponseAction) || // the || is kind of a fuzzy match
            normalizedResponseAction.includes(normalizeAction(a.name))    // 
        );
        
        if(action) {
          logger.success(`Found action: ${action?.name}`);
        } else {
          logger.error(`No action found for: ${responseAction}`);
        }

        if (!action) {
          logger.info("Attempting to find action in similes.");
          for (const _action of this.actions) {
            const simileAction = _action.similes.find(
              (simile) =>
                simile
                  .toLowerCase()
                  .replace("_", "")
                  .includes(normalizedResponseAction) ||
                normalizedResponseAction.includes(simile.toLowerCase().replace("_", ""))
            );
            if (simileAction) {
              action = _action;
              logger.success(`Action found in similes: ${action.name}`);
              break;
            }
          }
        }

        if (!action) {
          logger.error("No action found in", JSON.stringify(response));
          continue;
        }

        if (!action.handler) {
          logger.error(`Action ${action.name} has no handler.`);
          continue;
        }

        logger.success(`Executing handler for action: ${action.name}`);

        try {
          logger.info(`Executing handler for action: ${action.name}`);
          await action.handler(this, message, state, {}, callback, responses);
        } catch (error) {
          logger.error(error);
          throw error;
        }
      }
    }
  }

  /**
   * Evaluate the message and state using the registered evaluators.
   * @param message The message to evaluate.
   * @param state The state of the agent.
   * @param didRespond Whether the agent responded to the message.~
   * @param callback The handler callback
   * @returns The results of the evaluation.
   */
  async evaluate(
    message: Memory,
    state: State,
    didRespond?: boolean,
    callback?: HandlerCallback
  ) {
    const evaluatorPromises = this.evaluators.map(
      async (evaluator: Evaluator) => {
        logger.log("Evaluating", evaluator.name);
        if (!evaluator.handler) {
          return null;
        }
        if (!didRespond && !evaluator.alwaysRun) {
          return null;
        }
        const result = await evaluator.validate(this, message, state);
        if (result) {
          return evaluator;
        }
        return null;
      }
    );

    const evaluators = (await Promise.all(evaluatorPromises)).filter(Boolean) as Evaluator[];

    // get the evaluators that were chosen by the response handler

    for (const evaluator of evaluators) {
      if (evaluator.handler)
        await evaluator.handler(this, message, state, {}, callback);
    }

    return evaluators;
  }

  async ensureParticipantInRoom(userId: UUID, roomId: UUID) {
    // Make sure entity exists in database before adding as participant
    const entity = await this.databaseAdapter.getEntityById(userId);
    if (!entity) {
      throw new Error(`User ${userId} not found`);
    }
    // Get current participants
    const participants = await this.databaseAdapter.getParticipantsForRoom(
      roomId
    );

    // Only add if not already a participant
    if (!participants.includes(userId)) {
      // Add participant using the tenant-specific ID that now exists in the entities table
      const added = await this.databaseAdapter.addParticipant(userId, roomId);

      if (!added) {
        throw new Error(
          `Failed to add participant ${userId} to room ${roomId}`
        );
      }

      if (userId === this.agentId) {
        logger.log(
          `Agent ${this.character.name} linked to room ${roomId} successfully.`
        );
      } else {
        logger.log(`User ${userId} linked to room ${roomId} successfully.`);
      }
    }
  }

  async ensureConnection({
    userId,
    roomId,
    userName,
    name,
    source,
    type,
    channelId,
    serverId,
    worldId,
  }: {
    userId: UUID;
    roomId: UUID;
    userName?: string;
    name?: string;
    source?: string;
    type?: ChannelType;
    channelId?: string;
    serverId?: string;
    worldId?: UUID;
  }) {
    if (userId === this.agentId) {
      throw new Error("Agent should not connect to itself");
    }

    if (!worldId && serverId) {
      worldId = createUniqueUuid(this, serverId);
    }

    const names = [name, userName];
    const metadata = {
      [source]: {
        name: name,
        userName: userName,
      },
    };

    const entity = await this.databaseAdapter.getEntityById(userId);

    if (!entity) {
      await this.databaseAdapter.createEntity({
        id: userId,
        names,
        metadata,
        agentId: this.agentId,
      });
    }

    // Ensure world exists if worldId is provided
    if (worldId) {
      await this.ensureWorldExists({
        id: worldId,
        name: serverId
          ? `World for server ${serverId}`
          : `World for room ${roomId}`,
        agentId: this.agentId,
        serverId: serverId || "default",
        metadata,
      });
    }

    // Ensure room exists
    await this.ensureRoomExists({
      id: roomId,
      source,
      type,
      channelId,
      serverId,
      worldId,
    });

    // Now add participants using the original IDs (will be transformed internally)
    try {
      await this.ensureParticipantInRoom(userId, roomId);
      await this.ensureParticipantInRoom(this.agentId, roomId);
    } catch (error) {
      logger.error(
        `Failed to add participants: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  /**
   * Ensure the existence of a world.
   */
  async ensureWorldExists({ id, name, serverId, metadata }: World) {
    try {
      const world = await this.databaseAdapter.getWorld(id);
      if (!world) {
        logger.info("Creating world:", {
          id,
          name,
          serverId,
          agentId: this.agentId,
        });
        await this.databaseAdapter.createWorld({
          id,
          name,
          agentId: this.agentId,
          serverId: serverId || "default",
          metadata,
        });
        logger.info(`World ${id} created successfully.`);
      }
    } catch (error) {
      logger.error(
        `Failed to ensure world exists: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  /**
   * Ensure the existence of a room between the agent and a user. If no room exists, a new room is created and the user
   * and agent are added as participants. The room ID is returned.
   * @param userId - The user ID to create a room with.
   * @returns The room ID of the room between the agent and the user.
   * @throws An error if the room cannot be created.
   */
  async ensureRoomExists({
    id,
    name,
    source,
    type,
    channelId,
    serverId,
    worldId,
  }: Room) {
    const room = await this.databaseAdapter.getRoom(id);
    if (!room) {
      await this.databaseAdapter.createRoom({
        id,
        name,
        agentId: this.agentId,
        source,
        type,
        channelId,
        serverId,
        worldId,
      });
      logger.log(`Room ${id} created successfully.`);
    }
  }

  /**
   * Composes the agent's state by gathering data from enabled providers.
   * @param message - The message to use as context for state composition
   * @param additionalKeys - Optional key-value pairs to include in the state
   * @param filterList - Optional list of provider names to include, filtering out all others
   * @param includeList - Optional list of private provider names to include that would otherwise be filtered out
   * @returns A State object containing provider data, values, and text
   */
  async composeState(
    message: Memory,
    additionalKeys: { [key: string]: unknown } = null,
    filterList: string[] | null = null, // filter out providers that are not in the list
    includeList: string[] | null = null, // include providers that are private, dynamic or otherwise not included by default
  ): Promise<State> {
    const providersToGet = (filterList
      ? this.providers.filter((provider) =>
        filterList.includes(provider.name)
        )
      : this.providers).filter(provider => !provider.private && !provider.dynamic)
      // add any providers on the includeList that aren't already in the providersToGet array
      .concat(includeList.filter(provider => !providersToGet.includes(provider)).map(provider => this.providers.find(p => p.name === provider)));
      
    const privateProvidersToGet = includeList
      ? this.providers.filter((provider) =>
        includeList.includes(provider.name) ||
        filterList?.includes(provider.name)
        )
      : [];

    const providerData = (await Promise.all(
      Array.from(new Set([...providersToGet, ...privateProvidersToGet])).map(async (provider) => {
        const start = Date.now();
        const result = await provider.get(this, message);
        const duration = Date.now() - start;
        logger.warn(`${provider.name} Provider took ${duration}ms to respond`);
        return result;
      })
    ))

    const providers = providerData.map((result) => result.values).flat();

    // get cached state for this message ID
    const cachedState = (await this.stateCache.get(message.id)) || {
      values: {},
      data: {},
      providers: "",
    };

    const providersText = cachedState.providers
      + providers
        .map((result) => result.text)
        .filter((text) => text !== "")
        .join("\n\n");
    const data = { providers }

    const values = {
      ...cachedState.values,
      ...providerData.map((result) => result.values).flat(),
      ...(additionalKeys || {}),
    }

    const newState = {
      values: {
        ...cachedState.values,
        ...values,
        ...(additionalKeys || {}),
      },
      data: {
        ...cachedState.data,
        ...data
      },
      providers: providersText,
    };
    this.stateCache.set(message.id, newState);
    return newState;
  }

  getMemoryManager(tableName: string): IMemoryManager | null {
    return new MemoryManager({
      runtime: this,
      tableName: tableName,
    });
  }

  getService<T extends Service>(service: ServiceType): T | null {
    const serviceInstance = this.services.get(service);
    if (!serviceInstance) {
      logger.error(`Service ${service} not found`);
      return null;
    }
    return serviceInstance as T;
  }

  async registerService(service: typeof Service): Promise<void> {
    const serviceType = service.serviceType as ServiceType;
    if (!serviceType) {
      return;
    }
    logger.log(
      `${this.character.name}(${this.agentId}) - Registering service:`,
      serviceType
    );

    if (this.services.has(serviceType)) {
      logger.warn(
        `${this.character.name}(${this.agentId}) - Service ${serviceType} is already registered. Skipping registration.`
      );
      return;
    }

    const serviceInstance = await service.start(this);

    // Add the service to the services map
    this.services.set(serviceType, serviceInstance);
    logger.success(
      `${this.character.name}(${this.agentId}) - Service ${serviceType} registered successfully`
    );
  }

  registerModel(modelType: ModelType, handler: (params: any) => Promise<any>) {
    const modelKey =
      typeof modelType === "string" ? modelType : ModelTypes[modelType];
    if (!this.models.has(modelKey)) {
      this.models.set(modelKey, []);
    }
    this.models.get(modelKey)?.push(handler);
  }

  getModel(
    modelType: ModelType
  ): ((runtime: IAgentRuntime, params: any) => Promise<any>) | undefined {
    const modelKey =
      typeof modelType === "string" ? modelType : ModelTypes[modelType];
    const models = this.models.get(modelKey);
    if (!models?.length) {
      return undefined;
    }
    return models[0];
  }

  async useModel(modelType: ModelType, params: any): Promise<any> {
    const modelKey =
      typeof modelType === "string" ? modelType : ModelTypes[modelType];
    const model = this.getModel(modelKey);
    if (!model) {
      throw new Error(`No handler found for delegate type: ${modelKey}`);
    }

    const response = await model(this, params);
    return response;
  }

  registerEvent(event: string, handler: (params: any) => void) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)?.push(handler);
  }

  getEvent(event: string): ((params: any) => void)[] | undefined {
    return this.events.get(event);
  }

  emitEvent(event: string | string[], params: any) {
    // Handle both single event string and array of event strings
    const events = Array.isArray(event) ? event : [event];

    // Call handlers for each event
    for (const eventName of events) {
      const eventHandlers = this.events.get(eventName);

      if (eventHandlers) {
        for (const handler of eventHandlers) {
          handler(params);
        }
      }
    }
  }

  async ensureEmbeddingDimension() {
    logger.debug(
      `[AgentRuntime][${this.character.name}] Starting ensureEmbeddingDimension`
    );

    if (!this.databaseAdapter) {
      throw new Error(
        `[AgentRuntime][${this.character.name}] Database adapter not initialized before ensureEmbeddingDimension`
      );
    }

    try {
      const model = this.getModel(ModelTypes.TEXT_EMBEDDING);
      if (!model) {
        throw new Error(
          `[AgentRuntime][${this.character.name}] No TEXT_EMBEDDING model registered`
        );
      }

      logger.debug(
        `[AgentRuntime][${this.character.name}] Getting embedding dimensions`
      );
      const embedding = await this.useModel(ModelTypes.TEXT_EMBEDDING, null);

      if (!embedding || !embedding.length) {
        throw new Error(
          `[AgentRuntime][${this.character.name}] Invalid embedding received`
        );
      }

      logger.debug(
        `[AgentRuntime][${this.character.name}] Setting embedding dimension: ${embedding.length}`
      );
      await this.databaseAdapter.ensureEmbeddingDimension(embedding.length);
      logger.debug(
        `[AgentRuntime][${this.character.name}] Successfully set embedding dimension`
      );
    } catch (error) {
      logger.info(
        `[AgentRuntime][${this.character.name}] Error in ensureEmbeddingDimension:`,
        error
      );
      throw error;
    }
  }

  registerTaskWorker(taskHandler: TaskWorker): void {
    if (this.taskWorkers.has(taskHandler.name)) {
      logger.warn(
        `Task definition ${taskHandler.name} already registered. Will be overwritten.`
      );
    }
    this.taskWorkers.set(taskHandler.name, taskHandler);
  }

  getTaskWorker(name: string): TaskWorker | undefined {
    return this.taskWorkers.get(name);
  }
}
