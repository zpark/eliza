import { join } from "node:path";
import { names, uniqueNamesGenerator } from "unique-names-generator";
import { v4 as uuidv4 } from "uuid";
import {
  composeActionExamples,
  formatActionNames,
  formatActions,
} from "./actions.ts";
import { bootstrapPlugin } from "./bootstrap.ts";
import { addHeader, composeContext } from "./context.ts";
import { settings } from "./environment.ts";
import {
  evaluationTemplate,
  formatEvaluatorExamples,
  formatEvaluatorNames,
  formatEvaluators,
} from "./evaluators.ts";
import { createUniqueUuid, handlePluginImporting, logger } from "./index.ts";
import knowledge from "./knowledge.ts";
import { MemoryManager } from "./memory.ts";
import { formatActors, formatMessages, getActorDetails } from "./messages.ts";
import { parseJsonArrayFromText } from "./parsing.ts";
import { formatPosts } from "./posts.ts";
import { getProviders } from "./providers.ts";
import {
  type Action,
  type Actor,
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
  type ModelType,
  ModelTypes,
  type Plugin,
  type Provider,
  type RoomData,
  type Route,
  type Service,
  type ServiceType,
  type State,
  type TaskWorker,
  type UUID,
  type WorldData,
} from "./types.ts";
import { stringToUuid } from "./uuid.ts";

function formatKnowledge(knowledge: KnowledgeItem[]): string {
  return knowledge.map((knowledge) => `- ${knowledge.content.text}`).join("\n");
}

/**
 * Manages knowledge-related operations for the agent runtime
 */
class KnowledgeManager {
  private runtime: AgentRuntime;

  constructor(runtime: AgentRuntime, _knowledgeRoot: string) {
    this.runtime = runtime;
  }

  private async handleProcessingError(error: any, context: string) {
    logger.error(
      `Error ${context}:`,
      error?.message || error || "Unknown error"
    );
    throw error;
  }

  private async checkExistingKnowledge(knowledgeId: UUID): Promise<boolean> {
    const existingDocument = await this.runtime.documentsManager.getMemoryById(
      knowledgeId
    );
    return !!existingDocument;
  }

  async processCharacterKnowledge(items: string[]) {
    for (const item of items) {
      try {
        const knowledgeId = createUniqueUuid(this.runtime, item);
        if (await this.checkExistingKnowledge(knowledgeId)) {
          continue;
        }

        logger.info(
          "Processing knowledge for ",
          this.runtime.character.name,
          " - ",
          item.slice(0, 100)
        );

        await knowledge.set(this.runtime, {
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
}

/**
 * Manages memory-related operations and memory managers
 */
class MemoryManagerService {
  private runtime: IAgentRuntime;
  private memoryManagers: Map<string, IMemoryManager>;

  constructor(runtime: IAgentRuntime, knowledgeRoot: string) {
    this.runtime = runtime;
    this.memoryManagers = new Map();

    // Initialize default memory managers
    this.initializeDefaultManagers(knowledgeRoot);
  }

  private initializeDefaultManagers(_knowledgeRoot: string) {
    // Message manager for storing messages
    this.registerMemoryManager(
      new MemoryManager({
        runtime: this.runtime,
        tableName: "messages",
      })
    );

    // Description manager for storing user descriptions
    this.registerMemoryManager(
      new MemoryManager({
        runtime: this.runtime,
        tableName: "descriptions",
      })
    );

    // Documents manager for large documents
    this.registerMemoryManager(
      new MemoryManager({
        runtime: this.runtime,
        tableName: "documents",
      })
    );

    // Knowledge manager for searchable fragments
    this.registerMemoryManager(
      new MemoryManager({
        runtime: this.runtime,
        tableName: "fragments",
      })
    );
  }

  registerMemoryManager(manager: IMemoryManager): void {
    if (!manager.tableName) {
      throw new Error("Memory manager must have a tableName");
    }

    if (this.memoryManagers.has(manager.tableName)) {
      logger.warn(
        `Memory manager ${manager.tableName} is already registered. Skipping registration.`
      );
      return;
    }

    this.memoryManagers.set(manager.tableName, manager);
  }

  getMemoryManager(tableName: string): IMemoryManager | null {
    const manager = this.memoryManagers.get(tableName);
    if (!manager) {
      logger.debug(`Memory manager ${tableName} not found`);
      return null;
    }
    return manager;
  }

  private getRequiredMemoryManager(
    tableName: string,
    managerType: string
  ): IMemoryManager {
    const manager = this.getMemoryManager(tableName);
    if (!manager) {
      logger.error(`${managerType} manager not found`);
      throw new Error(`${managerType} manager not found`);
    }
    return manager;
  }

  getMessageManager(): IMemoryManager {
    return this.getRequiredMemoryManager("messages", "Message");
  }

  getDescriptionManager(): IMemoryManager {
    return this.getRequiredMemoryManager("descriptions", "Description");
  }

  getDocumentsManager(): IMemoryManager {
    return this.getRequiredMemoryManager("documents", "Documents");
  }

  getKnowledgeManager(): IMemoryManager {
    return this.getRequiredMemoryManager("fragments", "Knowledge");
  }

  getAllManagers(): Map<string, IMemoryManager> {
    return this.memoryManagers;
  }
}

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

  readonly fetch = fetch;
  services: Map<ServiceType, Service> = new Map();

  public adapters: IDatabaseAdapter[];

  private readonly knowledgeRoot: string;
  private readonly memoryManagerService: MemoryManagerService;

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

    this.memoryManagerService = new MemoryManagerService(
      this,
      this.knowledgeRoot
    );
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

  private async processCharacterKnowledge(items: string[]) {
    const knowledgeManager = new KnowledgeManager(this, this.knowledgeRoot);
    await knowledgeManager.processCharacterKnowledge(items);
  }

  setSetting(
    key: string,
    value: string | boolean | null | any,
    secret = false
  ) {
    if (secret) {
      if (this.character.secrets === undefined) this.character.secrets = {}
      this.character.secrets[key] = value;
    } else {
      if (this.character.settings === undefined) this.character.settings = {}
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
      if (!response.content?.action) {
        logger.warn("No action found in the response content.");
        continue;
      }

      const normalizedAction = response.content.action
        .toLowerCase()
        .replace("_", "");

      logger.success(`Normalized action: ${normalizedAction}`);

      let action = this.actions.find(
        (a: { name: string }) =>
          a.name.toLowerCase().replace("_", "").includes(normalizedAction) ||
          normalizedAction.includes(a.name.toLowerCase().replace("_", ""))
      );

      if (!action) {
        logger.info("Attempting to find action in similes.");
        for (const _action of this.actions) {
          const simileAction = _action.similes.find(
            (simile) =>
              simile
                .toLowerCase()
                .replace("_", "")
                .includes(normalizedAction) ||
              normalizedAction.includes(simile.toLowerCase().replace("_", ""))
          );
          if (simileAction) {
            action = _action;
            logger.success(`Action found in similes: ${action.name}`);
            break;
          }
        }
      }

      if (!action) {
        logger.error("No action found for", response.content.action);
        continue;
      }

      if (!action.handler) {
        logger.error(`Action ${action.name} has no handler.`);
        continue;
      }

      try {
        logger.info(`Executing handler for action: ${action.name}`);
        await action.handler(this, message, state, {}, callback, responses);
      } catch (error) {
        logger.error(error);
        throw error;
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

    const resolvedEvaluators = await Promise.all(evaluatorPromises);
    const evaluatorsData = resolvedEvaluators.filter(
      (evaluator): evaluator is Evaluator => evaluator !== null
    );

    // if there are no evaluators this frame, return
    if (!evaluatorsData || evaluatorsData.length === 0) {
      return [];
    }

    const context = composeContext({
      state: {
        ...state,
        evaluators: formatEvaluators(evaluatorsData),
        evaluatorNames: formatEvaluatorNames(evaluatorsData),
      },
      template:
        this.character.templates?.evaluationTemplate || evaluationTemplate,
    });

    const result = await this.useModel(ModelTypes.TEXT_SMALL, {
      context,
    });

    const evaluators = parseJsonArrayFromText(result) as unknown as string[];

    for (const evaluator of this.evaluators) {
      if (!evaluators?.includes(evaluator.name)) continue;

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
    userScreenName,
    source,
    type,
    channelId,
    serverId,
    worldId,
  }: {
    userId: UUID;
    roomId: UUID;
    userName?: string;
    userScreenName?: string;
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

    const names = [userScreenName, userName];
    const metadata = {
      [source]: {
        name: userScreenName,
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
  async ensureWorldExists({ id, name, serverId, metadata }: WorldData) {
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
  }: RoomData) {
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
   * Compose the state of the agent into an object that can be passed or used for response generation.
   * @param message The message to compose the state from.
   * @returns The state of the agent.
   */
  async composeState(
    message: Memory,
    additionalKeys: { [key: string]: unknown } = {}
  ) {
    const { roomId } = message;

    const conversationLength = this.getConversationLength();

    const [actorsData, recentMessagesData] = await Promise.all([
      getActorDetails({ runtime: this, roomId }),
      this.messageManager.getMemories({
        roomId,
        count: conversationLength,
        unique: false,
      }),
    ]);

    const actors = formatActors({ actors: actorsData ?? [] });

    const recentMessages = formatMessages({
      messages: recentMessagesData,
      actors: actorsData,
    });

    const recentPosts = formatPosts({
      messages: recentMessagesData,
      actors: actorsData,
      conversationHeader: false,
    });

    const senderName = actorsData?.find(
      (actor: Actor) => actor.id === message.userId
    )?.name;

    // TODO: We may wish to consolidate and just accept character.name here instead of the actor name
    const agentName =
      actorsData?.find((actor: Actor) => actor.id === this.agentId)?.name ||
      this.character.name;

    let allAttachments = message.content.attachments || [];

    if (recentMessagesData && Array.isArray(recentMessagesData)) {
      const lastMessageWithAttachment = recentMessagesData.find(
        (msg) => msg.content.attachments && msg.content.attachments.length > 0
      );

      if (lastMessageWithAttachment) {
        const lastMessageTime =
          lastMessageWithAttachment?.createdAt ?? Date.now();
        const oneHourBeforeLastMessage = lastMessageTime - 60 * 60 * 1000; // 1 hour before last message

        allAttachments = recentMessagesData.reverse().flatMap((msg) => {
          const msgTime = msg.createdAt ?? Date.now();
          const isWithinTime = msgTime >= oneHourBeforeLastMessage;
          const attachments = msg.content.attachments || [];
          if (!isWithinTime) {
            for (const attachment of attachments) {
              attachment.text = "[Hidden]";
            }
          }
          return attachments;
        });
      }
    }

    const formattedAttachments = allAttachments
      .map(
        (attachment) =>
          `ID: ${attachment.id}
    Name: ${attachment.title}
    URL: ${attachment.url}
    Type: ${attachment.source}
    Description: ${attachment.description}
    Text: ${attachment.text}
    `
      )
      .join("\n");

    const formattedCharacterPostExamples = !this.character.postExamples
      ? ""
      : this.character.postExamples
          .sort(() => 0.5 - Math.random())
          .map((post) => {
            const messageString = `${post}`;
            return messageString;
          })
          .slice(0, 50)
          .join("\n");

    const formattedCharacterMessageExamples = !this.character.messageExamples
      ? ""
      : this.character.messageExamples
          .sort(() => 0.5 - Math.random())
          .slice(0, 5)
          .map((example) => {
            const exampleNames = Array.from({ length: 5 }, () =>
              uniqueNamesGenerator({ dictionaries: [names] })
            );

            return example
              .map((message) => {
                let messageString = `${message.user}: ${message.content.text}${
                  message.content.action
                    ? ` (action: ${message.content.action})`
                    : ""
                }`;
                exampleNames.forEach((name, index) => {
                  const placeholder = `{{user${index + 1}}}`;
                  messageString = messageString.replaceAll(placeholder, name);
                });
                return messageString;
              })
              .join("\n");
          })
          .join("\n\n");

    const getRecentInteractions = async (
      sourceEntityId: UUID,
      targetEntityId: UUID
    ): Promise<Memory[]> => {
      // Find all rooms where sourceEntityId and targetEntityId are participants
      const rooms = await this.databaseAdapter.getRoomsForParticipants([
        sourceEntityId,
        targetEntityId,
      ]);

      // Check the existing memories in the database
      return this.messageManager.getMemoriesByRoomIds({
        // filter out the current room id from rooms
        roomIds: rooms.filter((room) => room !== roomId),
        limit: 20,
      });
    };

    const recentInteractions =
      message.userId !== this.agentId
        ? await getRecentInteractions(message.userId, this.agentId)
        : [];

    const getRecentMessageInteractions = async (
      recentInteractionsData: Memory[]
    ): Promise<string> => {
      // Format the recent messages
      const formattedInteractions = await Promise.all(
        recentInteractionsData.map(async (message) => {
          const isSelf = message.userId === this.agentId;
          let sender: string;
          if (isSelf) {
            sender = this.character.name;
          } else {
            // Lookup by tenant-specific ID since that's what's stored in the memory
            const accountId = await this.databaseAdapter.getEntityById(
              message.userId
            );
            sender = accountId?.metadata?.username || "unknown";
          }
          return `${sender}: ${message.content.text}`;
        })
      );

      return formattedInteractions.join("\n");
    };

    const formattedMessageInteractions = await getRecentMessageInteractions(
      recentInteractions
    );

    const getRecentPostInteractions = async (
      recentInteractionsData: Memory[],
      actors: Actor[]
    ): Promise<string> => {
      const formattedInteractions = formatPosts({
        messages: recentInteractionsData,
        actors,
        conversationHeader: true,
      });

      return formattedInteractions;
    };

    const formattedPostInteractions = await getRecentPostInteractions(
      recentInteractions,
      actorsData
    );

    // if bio is a string, use it. if its an array, pick one at random
    let bio = this.character.bio || "";
    if (Array.isArray(bio)) {
      // get three random bio strings and join them with " "
      bio = bio
        .sort(() => 0.5 - Math.random())
        .slice(0, 3)
        .join(" ");
    }

    let knowledgeData = [];
    let formattedKnowledge = "";

    knowledgeData = await knowledge.get(this, message);

    formattedKnowledge = formatKnowledge(knowledgeData);

    const system = this.character.system ?? "";

    const initialState = {
      agentId: this.agentId,
      agentName,
      system,
      bio,
      adjective:
        this.character.adjectives && this.character.adjectives.length > 0
          ? this.character.adjectives[
              Math.floor(Math.random() * this.character.adjectives.length)
            ]
          : "",
      knowledge: addHeader("# Knowledge", formattedKnowledge),
      knowledgeData: knowledgeData,
      // Recent interactions between the sender and receiver, formatted as messages
      recentMessageInteractions: formattedMessageInteractions,
      // Recent interactions between the sender and receiver, formatted as posts
      recentPostInteractions: formattedPostInteractions,
      // Raw memory[] array of interactions
      recentInteractionsData: recentInteractions,
      // randomly pick one topic
      topic:
        this.character.topics && this.character.topics.length > 0
          ? this.character.topics[
              Math.floor(Math.random() * this.character.topics.length)
            ]
          : null,
      topics:
        this.character.topics && this.character.topics.length > 0
          ? `${this.character.name} is interested in ${this.character.topics
              .sort(() => 0.5 - Math.random())
              .slice(0, 5)
              .map((topic, index, array) => {
                if (index === array.length - 2) {
                  return `${topic} and `;
                }
                // if last topic, don't add a comma
                if (index === array.length - 1) {
                  return topic;
                }
                return `${topic}, `;
              })
              .join("")}`
          : "",
      characterPostExamples:
        formattedCharacterPostExamples &&
        formattedCharacterPostExamples.replaceAll("\n", "").length > 0
          ? addHeader(
              `# Example Posts for ${this.character.name}`,
              formattedCharacterPostExamples
            )
          : "",
      characterMessageExamples:
        formattedCharacterMessageExamples &&
        formattedCharacterMessageExamples.replaceAll("\n", "").length > 0
          ? addHeader(
              `# Example Conversations for ${this.character.name}`,
              formattedCharacterMessageExamples
            )
          : "",
      messageDirections:
        this.character?.style?.all?.length > 0 ||
        this.character?.style?.chat.length > 0
          ? addHeader(
              `# Message Directions for ${this.character.name}`,
              (() => {
                const all = this.character?.style?.all || [];
                const chat = this.character?.style?.chat || [];
                return [...all, ...chat].join("\n");
              })()
            )
          : "",

      postDirections:
        this.character?.style?.all?.length > 0 ||
        this.character?.style?.post?.length > 0
          ? addHeader(
              `# Post Directions for ${this.character.name}`,
              (() => {
                const all = this.character?.style?.all || [];
                const post = this.character?.style?.post || [];
                return [...all, ...post].join("\n");
              })()
            )
          : "",

      // Agent runtime stuff
      senderName,
      actors:
        actors && actors.length > 0
          ? addHeader("# Actors in the Room", actors)
          : "",
      actorsData,
      roomId,
      recentMessages:
        recentMessages && recentMessages.length > 0
          ? addHeader("# Conversation Messages", recentMessages)
          : "",
      recentPosts:
        recentPosts && recentPosts.length > 0
          ? addHeader("# Posts in Thread", recentPosts)
          : "",
      recentMessagesData,
      attachments:
        formattedAttachments && formattedAttachments.length > 0
          ? addHeader("# Attachments", formattedAttachments)
          : "",
      ...additionalKeys,
    } as State;

    const actionPromises = this.actions.map(async (action: Action) => {
      const result = await action.validate(this, message, initialState);
      if (result) {
        return action;
      }
      return null;
    });

    const evaluatorPromises = this.evaluators.map(async (evaluator) => {
      const result = await evaluator.validate(this, message, initialState);
      if (result) {
        return evaluator;
      }
      return null;
    });

    const [resolvedEvaluators, resolvedActions, providers] = await Promise.all([
      Promise.all(evaluatorPromises),
      Promise.all(actionPromises),
      getProviders(this, message, initialState),
    ]);

    const evaluatorsData = resolvedEvaluators.filter(Boolean) as Evaluator[];
    const actionsData = resolvedActions.filter(Boolean) as Action[];

    const actionState = {
      actionNames: `Possible response actions: ${formatActionNames(
        actionsData
      )}`,
      actions:
        actionsData.length > 0
          ? addHeader("# Available Actions", formatActions(actionsData))
          : "",
      actionExamples:
        actionsData.length > 0
          ? addHeader(
              "# Action Examples",
              composeActionExamples(actionsData, 10)
            )
          : "",
      evaluatorsData,
      evaluators:
        evaluatorsData.length > 0 ? formatEvaluators(evaluatorsData) : "",
      evaluatorNames:
        evaluatorsData.length > 0 ? formatEvaluatorNames(evaluatorsData) : "",
      evaluatorExamples:
        evaluatorsData.length > 0
          ? formatEvaluatorExamples(evaluatorsData)
          : "",
      providers,
    };

    return { ...initialState, ...actionState } as State;
  }

  async updateRecentMessageState(state: State): Promise<State> {
    const conversationLength = this.getConversationLength();
    const recentMessagesData = await this.messageManager.getMemories({
      roomId: state.roomId,
      count: conversationLength,
      unique: false,
    });

    const recentMessages = formatMessages({
      actors: state.actorsData ?? [],
      messages: recentMessagesData.map((memory: Memory) => {
        const newMemory = { ...memory };
        newMemory.embedding = undefined;
        return newMemory;
      }),
    });

    let allAttachments = [];

    if (recentMessagesData && Array.isArray(recentMessagesData)) {
      const lastMessageWithAttachment = recentMessagesData.find(
        (msg) => msg.content.attachments && msg.content.attachments.length > 0
      );

      if (lastMessageWithAttachment) {
        const lastMessageTime =
          lastMessageWithAttachment?.createdAt ?? Date.now();
        const oneHourBeforeLastMessage = lastMessageTime - 60 * 60 * 1000; // 1 hour before last message

        allAttachments = recentMessagesData
          .filter((msg) => {
            const msgTime = msg.createdAt ?? Date.now();
            return msgTime >= oneHourBeforeLastMessage;
          })
          .flatMap((msg) => msg.content.attachments || []);
      }
    }

    const formattedAttachments = allAttachments
      .map(
        (attachment) =>
          `ID: ${attachment.id}
            Name: ${attachment.title}
            URL: ${attachment.url}
            Type: ${attachment.source}
            Description: ${attachment.description}
            Text: ${attachment.text}
                `
      )
      .join("\n");

    return {
      ...state,
      recentMessages: addHeader("# Conversation Messages", recentMessages),
      recentMessagesData,
      attachments: formattedAttachments,
    } as State;
  }

  // IAgentRuntime interface implementation
  registerMemoryManager(manager: IMemoryManager): void {
    this.memoryManagerService.registerMemoryManager(manager);
  }

  getMemoryManager(tableName: string): IMemoryManager | null {
    return this.memoryManagerService.getMemoryManager(tableName);
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

  // Memory manager getters
  get messageManager(): IMemoryManager {
    return this.memoryManagerService.getMessageManager();
  }

  get descriptionManager(): IMemoryManager {
    return this.memoryManagerService.getDescriptionManager();
  }

  get documentsManager(): IMemoryManager {
    return this.memoryManagerService.getDocumentsManager();
  }

  get knowledgeManager(): IMemoryManager {
    return this.memoryManagerService.getKnowledgeManager();
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
    logger.log(
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

      logger.info(
        `[AgentRuntime][${this.character.name}] Getting embedding dimensions`
      );
      const embedding = await this.useModel(ModelTypes.TEXT_EMBEDDING, null);

      if (!embedding || !embedding.length) {
        throw new Error(
          `[AgentRuntime][${this.character.name}] Invalid embedding received`
        );
      }

      logger.info(
        `[AgentRuntime][${this.character.name}] Setting embedding dimension: ${embedding.length}`
      );
      await this.databaseAdapter.ensureEmbeddingDimension(embedding.length);
      logger.info(
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
