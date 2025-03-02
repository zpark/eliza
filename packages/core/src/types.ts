/**
 * Represents a UUID string in the format "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
 */
export type UUID = `${string}-${string}-${string}-${string}-${string}`;

/**
 * Represents the content of a message or communication
 */
export interface Content {
  /** The main text content */
  text: string;

  /** Optional action associated with the message */
  action?: string;

  /** Optional source/origin of the content */
  source?: string;

  /** URL of the original message/post (e.g. tweet URL, Discord message link) */
  url?: string;

  /** UUID of parent message if this is a reply/thread */
  inReplyTo?: UUID;

  /** Array of media attachments */
  attachments?: Media[];

  /** Additional dynamic properties */
  [key: string]: unknown;
}

/**
 * Example content with associated user for demonstration purposes
 */
export interface ActionExample {
  /** User associated with the example */
  user: string;

  /** Content of the example */
  content: Content;
}

/**
 * Example conversation content with user ID
 */
export interface ConversationExample {
  /** UUID of user in conversation */
  userId: UUID;

  /** Content of the conversation */
  content: Content;
}

/**
 * Represents an actor/participant in a conversation
 */
export interface Actor {
  /** Unique identifier */
  id: UUID;

  /** Display name */
  name: string;

  /** All names for the actor */
  names: string[];

  /** Arbitrary data which can be displayed */
  data: any;
}

/**
 * Represents a single objective within a goal
 */
export interface Objective {
  /** Optional unique identifier */
  id?: string;

  /** Description of what needs to be achieved */
  description: string;

  /** Whether objective is completed */
  completed: boolean;
}

/**
 * Status enum for goals
 */
export enum GoalStatus {
  DONE = "DONE",
  FAILED = "FAILED",
  IN_PROGRESS = "IN_PROGRESS",
}

/**
 * Represents a high-level goal composed of objectives
 */
export interface Goal {
  /** Optional unique identifier */
  id?: UUID;

  /** Room ID where goal exists */
  roomId: UUID;

  /** User ID of goal owner */
  userId: UUID;

  /** Name/title of the goal */
  name: string;

  /** Current status */
  status: GoalStatus;

  /** Component objectives */
  objectives: Objective[];
}

/**
 * Model size/type classification
 */
export enum ModelClass {
  SMALL = "text_small", // for backwards compatibility
  MEDIUM = "text_large", // for backwards compatibility
  LARGE = "text_large", // for backwards compatibility
  TEXT_SMALL = "text_small",
  TEXT_LARGE = "text_large",
  TEXT_EMBEDDING = "text_embedding",
  TEXT_TOKENIZER_ENCODE = "TEXT_TOKENIZER_ENCODE",
  TEXT_TOKENIZER_DECODE = "TEXT_TOKENIZER_DECODE",
  TEXT_REASONING_SMALL = "reasoning_small",
  TEXT_REASONING_LARGE = "reasoning_large",
  IMAGE = "image",
  IMAGE_DESCRIPTION = "image_description",
  TRANSCRIPTION = "transcription",
  TEXT_TO_SPEECH = "text_to_speech",
  AUDIO = "audio",
  VIDEO = "video",
}

export enum ServiceType {
  TRANSCRIPTION = "transcription",
  VIDEO = "video",
  BROWSER = "browser",
  PDF = "pdf",
  REMOTE_FILES = "aws_s3",
  WEB_SEARCH = "web_search",
  EMAIL = "email",
  TEE = "tee",
}

/**
 * Represents the current state/context of a conversation
 */
export interface State {
  /** ID of user who sent current message */
  userId?: UUID;

  /** ID of agent in conversation */
  agentId?: UUID;

  /** System prompt */
  system?: string;

  /** Agent's biography */
  bio: string;

  /** Message handling directions */
  messageDirections: string;

  /** Post handling directions */
  postDirections: string;

  /** Current room/conversation ID */
  roomId: UUID;

  /** Optional agent name */
  agentName?: string;

  /** Optional message sender name */
  senderName?: string;

  /** String representation of conversation actors */
  actors: string;

  /** Optional array of actor objects */
  actorsData?: Actor[];

  /** Optional string representation of goals */
  goals?: string;

  /** Optional array of goal objects */
  goalsData?: Goal[];

  /** Recent message history as string */
  recentMessages: string;

  /** Recent message objects */
  recentMessagesData: Memory[];

  /** Optional valid action names */
  actionNames?: string;

  /** Optional action descriptions */
  actions?: string;

  /** Optional action objects */
  actionsData?: Action[];

  /** Optional action examples */
  actionExamples?: string;

  /** Optional provider descriptions */
  providers?: string;

  /** Optional response content */
  responseData?: Content;

  /** Optional recent interaction objects */
  recentInteractionsData?: Memory[];

  /** Optional recent interactions string */
  recentInteractions?: string;

  /** Optional formatted conversation */
  formattedConversation?: string;

  /** Optional formatted knowledge */
  knowledge?: string;
  /** Optional knowledge data */
  knowledgeData?: KnowledgeItem[];

  /** Additional dynamic properties */
  [key: string]: unknown;
}

export enum MemoryType {
    DOCUMENT = "document",
    FRAGMENT = "fragment",
    MESSAGE = "message",
    DESCRIPTION = "description"
}

export interface BaseMetadata {
    type: MemoryType;          
    source?: string;           
    sourceId?: UUID;           
    scope?: string;            
    timestamp?: number;        
    tags?: string[];          
}

export interface DocumentMetadata extends BaseMetadata {
    type: MemoryType.DOCUMENT;
}

export interface FragmentMetadata extends BaseMetadata {
    type: MemoryType.FRAGMENT;
    documentId: UUID;      
    position: number;      
}

export interface MessageMetadata extends BaseMetadata {
    type: MemoryType.MESSAGE;
}

export interface DescriptionMetadata extends BaseMetadata {
    type: MemoryType.DESCRIPTION;
}

export type KnowledgeMetadata = 
    | DocumentMetadata 
    | FragmentMetadata 
    | MessageMetadata 
    | DescriptionMetadata;

/**
 * Represents a stored memory/message
 */
export interface Memory {
  /** Optional unique identifier */
  id?: UUID;

  /** Associated user ID */
  userId: UUID;

  /** Associated agent ID */
  agentId?: UUID;

  /** Optional creation timestamp */
  createdAt?: number;

  /** Memory content */
  content: Content;

  /** Optional embedding vector */
  embedding?: number[];

  /** Associated room ID */
  roomId: UUID;

  /** Whether memory is unique */
  unique?: boolean;

  /** Embedding similarity score */
  similarity?: number;

  /** Metadata for the knowledge */
  metadata?: KnowledgeMetadata;
}

/**
 * Example message for demonstration
 */
export interface MessageExample {
  /** Associated user */
  user: string;

  /** Message content */
  content: Content;
}

/**
 * Handler function type for processing messages
 */
export type Handler = (
  runtime: IAgentRuntime,
  message: Memory,
  state?: State,
  options?: { [key: string]: unknown },
  callback?: HandlerCallback,
  responses?: Memory[]
) => Promise<unknown>;

/**
 * Callback function type for handlers
 */
export type HandlerCallback = (
  response: Content,
  files?: any
) => Promise<Memory[]>;

/**
 * Validator function type for actions/evaluators
 */
export type Validator = (
  runtime: IAgentRuntime,
  message: Memory,
  state?: State
) => Promise<boolean>;

/**
 * Represents an action the agent can perform
 */
export interface Action {
  /** Similar action descriptions */
  similes?: string[];

  /** Detailed description */
  description: string;

  /** Example usages */
  examples?: ActionExample[][];

  /** Handler function */
  handler: Handler;

  /** Action name */
  name: string;

  /** Validation function */
  validate: Validator;
}

/**
 * Example for evaluating agent behavior
 */
export interface EvaluationExample {
  /** Evaluation context */
  context: string;

  /** Example messages */
  messages: Array<ActionExample>;

  /** Expected outcome */
  outcome: string;
}

/**
 * Evaluator for assessing agent responses
 */
export interface Evaluator {
  /** Whether to always run */
  alwaysRun?: boolean;

  /** Detailed description */
  description: string;

  /** Similar evaluator descriptions */
  similes: string[];

  /** Example evaluations */
  examples: EvaluationExample[];

  /** Handler function */
  handler: Handler;

  /** Evaluator name */
  name: string;

  /** Validation function */
  validate: Validator;
}

/**
 * Provider for external data/services
 */
export interface Provider {
  /** Data retrieval function */
  get: (runtime: IAgentRuntime, message: Memory, state?: State) => Promise<any>;
}

/**
 * Represents a relationship between users
 */
export interface Relationship {
  /** Unique identifier */
  id: UUID;

  /** First user ID */
  sourceEntityId: UUID;

  /** Second user ID */
  targetEntityId: UUID;

  /** Agent ID */
  agentId: UUID;

  /** Tags for filtering/categorizing relationships */
  tags: string[];

  /** Additional metadata about the relationship */
  metadata: {
    [key: string]: any
  }

  /** Optional creation timestamp */
  createdAt?: string;
}

export interface Component {
  id: UUID;
  entityId: UUID;
  agentId: UUID;
  roomId: UUID;
  worldId: UUID;
  sourceEntityId: UUID;
  type: string;
  data: {
    [key: string]: any;
  };
}

/**
 * Represents a user account
 */
export interface Entity {
  /** Unique identifier, optional on creation */
  id?: UUID;

  /** Names of the entity */
  names: string[];

  /** Optional additional metadata */
  metadata?: { [key: string]: any };

  /** Agent ID this account is related to, for agents should be themselves */
  agentId: UUID;

  /** Optional array of components */
  components?: Component[];
}

/**
 * Room participant with account details
 */
export interface Participant {
  /** Unique identifier */
  id: UUID;

  /** Associated account */
  entity: Entity;
}

/**
 * Represents a conversation room
 */
export interface Room {
  /** Unique identifier */
  id: UUID;

  /** Room name */
  name: string;

  /** Room participants */
  participants: Participant[];
}

/**
 * Represents a media attachment
 */
export type Media = {
  /** Unique identifier */
  id: string;

  /** Media URL */
  url: string;

  /** Media title */
  title: string;

  /** Media source */
  source: string;

  /** Media description */
  description: string;

  /** Text content */
  text: string;

  /** Content type */
  contentType?: string;
};

export enum ChannelType {
  SELF = "SELF",
  DM = "DM",
  GROUP = "GROUP",
  VOICE_DM = "VOICE_DM",
  VOICE_GROUP = "VOICE_GROUP",
  FEED = "FEED",
  WORLD = "WORLD",
  API = "API",
  FORUM = "FORUM",
}

export type PostClient = {
  getPost: (roomId: UUID) => Promise<string | UUID | null>;
};

/**
 * Client instance
 */
export type ClientInstance = {
  [key: string]: any;
  /** Stop client connection */
  stop: (runtime: IAgentRuntime) => Promise<unknown>;
};

/**
 * Client interface for platform connections
 */
export type Client = {
  /** Client name */
  name: string;

  /** Client configuration */
  config?: { [key: string]: any };

  /** Start client connection */
  start: (runtime: IAgentRuntime) => Promise<ClientInstance>;
};

export type Adapter = {
  /** Initialize adapter */
  init: (runtime: IAgentRuntime) => Promise<IDatabaseAdapter>;
};

export type Route = {
  type: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  // TODO: give me strong types
  handler: (req: any, res: any) => Promise<void>;
};

/**
 * Plugin for extending agent functionality
 */
export type Plugin = {
  /** Plugin name */
  name: string;

  /** Initialization function */
  init?: (config: Record<string, string>, runtime: IAgentRuntime) => Promise<void>;

  /** Plugin configuration */
  config?: { [key: string]: any };

  /** Plugin description */
  description: string;

  /** Optional actions */
  actions?: Action[];

  /** Optional providers */
  providers?: Provider[];

  /** Optional evaluators */
  evaluators?: Evaluator[];

  /** Optional clients */
  clients?: Client[];

  /** Optional services */
  services?: Service[];

  /** Optional adapters */
  adapters?: Adapter[];

  /** Optional memory managers */
  memoryManagers?: IMemoryManager[];

  /** Optional models */
  models?: {
    [key: string]: (...args: any[]) => Promise<any>;
  };

  /** Optional events */
  events?: {
    [key: string]: ((params: any) => Promise<any>)[];
  };

  /** Optional tests */
  tests?: TestSuite[];

  /** Optional routes */
  routes?: Route[];
};

export interface ModelConfiguration {
  temperature?: number;
  maxOutputTokens?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  maxInputTokens?: number;
}

export type TemplateType = string | ((options: { state: State }) => string);

/**
 * Configuration for an agent character
 */
export interface Character {
  /** Optional unique identifier */
  id?: UUID;

  /** Character name */
  name: string;

  /** Optional username */
  username?: string;

  /** Optional system prompt */
  system?: string;

  /** Optional prompt templates */
  templates?: {
    [key: string]: TemplateType;
  };

  /** Character biography */
  bio: string | string[];

  /** Example messages */
  messageExamples?: MessageExample[][];

  /** Example posts */
  postExamples?: string[];

  /** Known topics */
  topics?: string[];

  /** Character traits */
  adjectives?: string[];

  /** Optional knowledge base */
  knowledge?: (string | { path: string; shared?: boolean })[];

  /** Available plugins */
  plugins?: string[];

  /** Optional configuration */
  settings?: {
    [key: string]: any | string | boolean | number;
  };

  /** Optional secrets */
  secrets?: {
    [key: string]: string | boolean | number;
  };

  /** Writing style guides */
  style?: {
    all?: string[];
    chat?: string[];
    post?: string[];
  };
}

export interface Agent extends Character {
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * Interface for database operations
 */
export interface IDatabaseAdapter {
  /** Database instance */
  db: any;

  /** Optional initialization */
  init(): Promise<void>;

  /** Close database connection */
  close(): Promise<void>;

  getAgent(agentId: UUID): Promise<Agent | null>;

  /** Get all agents */
  getAgents(): Promise<Agent[]>;

  createAgent(agent: Agent): Promise<boolean>;

  updateAgent(agent: Agent): Promise<boolean>;

  toggleAgent(agentId: UUID, enabled: boolean): Promise<boolean>;

  deleteAgent(agentId: UUID): Promise<boolean>;

  ensureAgentExists(agent: Partial<Agent>): Promise<void>;

  ensureEmbeddingDimension(dimension: number): Promise<void>;

  /** Get entity by ID */
  getEntityById(userId: UUID): Promise<Entity | null>;

  /** Get entities for room */
  getEntitiesForRoom(roomId: UUID, includeComponents?: boolean): Promise<Entity[]>;

  /** Create new entity */
  createEntity(entity: Entity): Promise<boolean>;

  /** Update entity */
  updateEntity(entity: Entity): Promise<void>;

  /** Get component by ID */
  getComponent(entityId: UUID, type: string, worldId?: UUID, sourceEntityId?: UUID): Promise<Component | null>;

  /** Get all components for an entity */
  getComponents(entityId: UUID, worldId?: UUID, sourceEntityId?: UUID): Promise<Component[]>;

  /** Create component */
  createComponent(component: Component): Promise<boolean>;
  
  /** Update component */
  updateComponent(component: Component): Promise<void>;

  /** Delete component */
  deleteComponent(componentId: UUID): Promise<void>;

  /** Get memories matching criteria */
  getMemories(params: {
    roomId: UUID;
    count?: number;
    unique?: boolean;
    tableName: string;
    start?: number;
    end?: number;
  }): Promise<Memory[]>;

  getMemoryById(id: UUID): Promise<Memory | null>;

  getMemoriesByIds(ids: UUID[], tableName?: string): Promise<Memory[]>;

  getMemoriesByRoomIds(params: {
    tableName: string;
    roomIds: UUID[];
    limit?: number;
  }): Promise<Memory[]>;

  getCachedEmbeddings(params: {
    query_table_name: string;
    query_threshold: number;
    query_input: string;
    query_field_name: string;
    query_field_sub_name: string;
    query_match_count: number;
  }): Promise<{ embedding: number[]; levenshtein_score: number }[]>;

  log(params: {
    body: { [key: string]: unknown };
    userId: UUID;
    roomId: UUID;
    type: string;
  }): Promise<void>;

  updateGoalStatus(params: { goalId: UUID; status: GoalStatus }): Promise<void>;

  searchMemories(params: {
    embedding: number[];
    match_threshold?: number;
    count?: number;
    roomId?: UUID;
    unique?: boolean;
    tableName: string;
  }): Promise<Memory[]>;

  createMemory(
    memory: Memory,
    tableName: string,
    unique?: boolean
  ): Promise<UUID>;

  removeMemory(memoryId: UUID, tableName: string): Promise<void>;

  removeAllMemories(roomId: UUID, tableName: string): Promise<void>;

  countMemories(
    roomId: UUID,
    unique?: boolean,
    tableName?: string
  ): Promise<number>;

  getGoals(params: {
    roomId: UUID;
    userId?: UUID | null;
    onlyInProgress?: boolean;
    count?: number;
  }): Promise<Goal[]>;

  updateGoal(goal: Goal): Promise<void>;

  createGoal(goal: Goal): Promise<void>;

  removeGoal(goalId: UUID): Promise<void>;

  removeAllGoals(roomId: UUID): Promise<void>;

  createWorld({
    id,
    name,
    serverId,
    metadata
  }: WorldData): Promise<UUID>;

  getWorld(id: UUID): Promise<WorldData | null>;

  getAllWorlds(): Promise<WorldData[]>;

  updateWorld(world: WorldData): Promise<void>;

  getRoom(roomId: UUID): Promise<RoomData | null>;

  createRoom({
    id,
    name,
    source,
    type,
    channelId,
    serverId,
    worldId,
  }: RoomData): Promise<UUID>;

  removeRoom(roomId: UUID): Promise<void>;

  updateRoom(room: RoomData): Promise<void>;

  getRoomsForParticipant(userId: UUID): Promise<UUID[]>;

  getRoomsForParticipants(userIds: UUID[]): Promise<UUID[]>;

  getRooms(worldId: UUID): Promise<RoomData[]>;
  
  addParticipant(userId: UUID, roomId: UUID): Promise<boolean>;

  removeParticipant(userId: UUID, roomId: UUID): Promise<boolean>;

  getParticipantsForAccount(userId: UUID): Promise<Participant[]>;

  getParticipantsForRoom(roomId: UUID): Promise<UUID[]>;

  getParticipantUserState(
    roomId: UUID,
    userId: UUID
  ): Promise<"FOLLOWED" | "MUTED" | null>;

  setParticipantUserState(
    roomId: UUID,
    userId: UUID,
    state: "FOLLOWED" | "MUTED" | null
  ): Promise<void>;

  /**
   * Creates a new relationship between two entities.
   * @param params Object containing the relationship details
   * @returns Promise resolving to boolean indicating success
   */
  createRelationship(params: {
    sourceEntityId: UUID;
    targetEntityId: UUID;
    tags?: string[];
    metadata?: { [key: string]: any };
  }): Promise<boolean>;

  /**
   * Updates an existing relationship between two entities.
   * @param relationship The relationship object with updated data
   * @returns Promise resolving to void
   */
  updateRelationship(relationship: Relationship): Promise<void>;

  /**
   * Retrieves a relationship between two entities if it exists.
   * @param params Object containing the entity IDs and agent ID
   * @returns Promise resolving to the Relationship object or null if not found
   */
  getRelationship(params: {
    sourceEntityId: UUID;
    targetEntityId: UUID;
  }): Promise<Relationship | null>;

  /**
   * Retrieves all relationships for a specific entity.
   * @param params Object containing the user ID, agent ID and optional tags to filter by
   * @returns Promise resolving to an array of Relationship objects
   */
  getRelationships(params: {
    userId: UUID;
    tags?: string[];
  }): Promise<Relationship[]>;

  ensureEmbeddingDimension(dimension: number): void;

  getCache(key: string): Promise<string | undefined>;

  setCache(key: string, value: string,): Promise<boolean>;

  deleteCache(key: string): Promise<boolean>;
}

export interface IMemoryManager {
  runtime: IAgentRuntime;
  tableName: string;
  constructor: Function;

  addEmbeddingToMemory(memory: Memory): Promise<Memory>;

  getMemories(opts: {
    roomId: UUID;
    count?: number;
    unique?: boolean;
    start?: number;
    end?: number;
  }): Promise<Memory[]>;

  searchMemories(params: {
    embedding: number[];
    match_threshold?: number;
    count?: number;
    roomId?: UUID;
    unique?: boolean;
    metadata?: KnowledgeMetadata;
  }): Promise<Memory[]>;

  getCachedEmbeddings(
    content: string
  ): Promise<{ embedding: number[]; levenshtein_score: number }[]>;

  getMemoryById(id: UUID): Promise<Memory | null>;
  getMemoriesByRoomIds(params: {
    roomIds: UUID[];
    limit?: number;
  }): Promise<Memory[]>;

  createMemory(memory: Memory, unique?: boolean): Promise<UUID>;

  removeMemory(memoryId: UUID): Promise<void>;

  removeAllMemories(roomId: UUID): Promise<void>;

  countMemories(roomId: UUID, unique?: boolean): Promise<number>;
}

export type CacheOptions = {
  expires?: number;
};

export abstract class Service {
  private static instance: Service | null = null;

  static get serviceType(): ServiceType | string {
    throw new Error("Service must implement static serviceType getter");
  }

  public static getInstance<T extends Service>(): T {
    if (!Service.instance) {
      Service.instance = new (Service as any)();
    }
    return Service.instance as T;
  }

  get serviceType(): ServiceType | string {
    return (this.constructor as typeof Service).serviceType;
  }

  // Add abstract initialize method that must be implemented by derived classes
  abstract initialize(runtime: IAgentRuntime): Promise<void>;
}

export interface IAgentRuntime {
  // Properties
  agentId: UUID;
  databaseAdapter: IDatabaseAdapter;
  adapters: Adapter[];
  character: Character;
  providers: Provider[];
  actions: Action[];
  evaluators: Evaluator[];
  plugins: Plugin[];

  events: Map<string, ((params: any) => void)[]>;

  fetch?: typeof fetch | null;
  routes: Route[];
  messageManager: IMemoryManager;
  descriptionManager: IMemoryManager;
  documentsManager: IMemoryManager;
  knowledgeManager: IMemoryManager;

  getClient(name: string): ClientInstance | null;
  getAllClients(): Map<string, ClientInstance>;

  registerClientInterface(name: string, client: Client): void;
  registerClient(name: string, client: ClientInstance): void;

  unregisterClient(name: string): void;

  initialize(): Promise<void>;

  registerMemoryManager(manager: IMemoryManager): void;

  getMemoryManager(tableName: string): IMemoryManager | null;

  getService<T extends Service>(service: ServiceType): T | null;

  registerService(service: Service): void;

  setSetting(
    key: string,
    value: string | boolean | null | any,
    secret: boolean
  ): void;

  getSetting(key: string): string | boolean | null | any;

  // Methods
  getConversationLength(): number;

  processActions(
    message: Memory,
    responses: Memory[],
    state?: State,
    callback?: HandlerCallback
  ): Promise<void>;

  evaluate(
    message: Memory,
    state?: State,
    didRespond?: boolean,
    callback?: HandlerCallback
  ): Promise<string[] | null>;

  registerProvider(provider: Provider): void;

  registerAction(action: Action): void;

  registerEvaluator(evaluator: Evaluator): void;

  ensureConnection({
    userId,
    roomId,
    userName,
    userScreenName,
    source,
    channelId,
    serverId,
    type,
    worldId
  }: {
    userId: UUID;
    roomId: UUID;
    userName?: string;
    userScreenName?: string;
    source?: string;
    channelId?: string;
    serverId?: string;
    type: ChannelType;
    worldId?: UUID;
  }): Promise<void>;

  ensureParticipantInRoom(userId: UUID, roomId: UUID): Promise<void>;

  ensureWorldExists({
    id,
    name,
    serverId,
    metadata
  }: WorldData): Promise<void>;

  ensureRoomExists({
    id,
    name,
    source,
    type,
    channelId,
    serverId,
    worldId,
  }: RoomData): Promise<void>;

  composeState(
    message: Memory,
    additionalKeys?: { [key: string]: unknown }
  ): Promise<State>;

  updateRecentMessageState(state: State): Promise<State>;

  useModel<T = any>(modelClass: ModelClass, params: T): Promise<any>;
  registerModel(
    modelClass: ModelClass,
    handler: (params: any) => Promise<any>
  ): void;
  getModel(
    modelClass: ModelClass
  ): ((runtime: IAgentRuntime, params: any) => Promise<any>) | undefined;

  registerEvent(event: string, handler: (params: any) => void): void;
  getEvent(event: string): ((params: any) => void)[] | undefined;
  emitEvent(event: string | string[], params: any): void;

  registerTask(task: Task): UUID;
  getTasks({
    roomId,
    tags,
  }: {
    roomId?: UUID;
    tags?: string[];
  }): Task[] | undefined;
  getTask(id: UUID): Task | undefined;
  updateTask(id: UUID, task: Task): void;
  deleteTask(id: UUID): void;

  stop(): Promise<void>;

  ensureEmbeddingDimension(): Promise<void>;
}

export enum LoggingLevel {
  DEBUG = "debug",
  VERBOSE = "verbose",
  NONE = "none",
}

export type KnowledgeItem = {
  id: UUID;
  content: Content;
};

export enum KnowledgeScope {
  SHARED = "shared",
  PRIVATE = "private",
}

export enum CacheKeyPrefix {
  KNOWLEDGE = "knowledge",
}

export interface DirectoryItem {
  directory: string;
  shared?: boolean;
}

export interface ChunkRow {
  id: string;
  // Add other properties if needed
}

export type GenerateTextParams = {
  runtime: IAgentRuntime;
  context: string;
  modelClass: ModelClass;
  maxTokens?: number;
  temperature?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
};

export interface TokenizeTextParams {
  context: string;
  modelClass: ModelClass;
}

export interface DetokenizeTextParams {
  tokens: number[];
  modelClass: ModelClass;
}

export interface IVideoService extends Service {
  isVideoUrl(url: string): boolean;
  fetchVideoInfo(url: string): Promise<Media>;
  downloadVideo(videoInfo: Media): Promise<string>;
  processVideo(url: string, runtime: IAgentRuntime): Promise<Media>;
}

export interface IBrowserService extends Service {
  closeBrowser(): Promise<void>;
  getPageContent(
    url: string,
    runtime: IAgentRuntime
  ): Promise<{ title: string; description: string; bodyContent: string }>;
}

export interface IPdfService extends Service {
  getInstance(): IPdfService;
  convertPdfToText(pdfBuffer: Buffer): Promise<string>;
}

export interface IFileService extends Service {
  uploadFile(
    imagePath: string,
    subDirectory: string,
    useSignedUrl: boolean,
    expiresIn: number
  ): Promise<{
    success: boolean;
    url?: string;
    error?: string;
  }>;
  generateSignedUrl(fileName: string, expiresIn: number): Promise<string>;
}

export interface ITeeLogService extends Service {
  getInstance(): ITeeLogService;
  log(
    agentId: string,
    roomId: string,
    userId: string,
    type: string,
    content: string
  ): Promise<boolean>;

  generateAttestation<T>(
    reportData: string,
    hashAlgorithm?: T | any
  ): Promise<string>;
  getAllAgents(): Promise<TeeAgent[]>;
  getAgent(agentId: string): Promise<TeeAgent | null>;
  getLogs(
    query: TeeLogQuery,
    page: number,
    pageSize: number
  ): Promise<TeePageQuery<TeeLog[]>>;
}

export interface TestCase {
  name: string;
  fn: (runtime: IAgentRuntime) => Promise<void> | void;
}

export interface TestSuite {
  name: string;
  tests: TestCase[];
}

// Represents a log entry in the TeeLog table, containing details about agent activities.
export interface TeeLog {
  id: string;
  agentId: string;
  roomId: string;
  userId: string;
  type: string;
  content: string;
  timestamp: number;
  signature: string;
}

export interface TeeLogQuery {
  agentId?: string;
  roomId?: string;
  userId?: string;
  type?: string;
  containsContent?: string;
  startTimestamp?: number;
  endTimestamp?: number;
}

// Represents an agent in the TeeAgent table, containing details about the agent.
export interface TeeAgent {
  id: string; // Primary key
  // Allow duplicate agentId.
  // This is to support the case where the same agentId is registered multiple times.
  // Each time the agent restarts, we will generate a new keypair and attestation.
  agentId: string;
  agentName: string;
  createdAt: number;
  publicKey: string;
  attestation: string;
}

export interface TeePageQuery<Result = any> {
  page: number;
  pageSize: number;
  total?: number;
  data?: Result;
}

export abstract class TeeLogDAO<DB = any> {
  db: DB;

  abstract initialize(): Promise<void>;

  abstract addLog(log: TeeLog): Promise<boolean>;

  abstract getPagedLogs(
    query: TeeLogQuery,
    page: number,
    pageSize: number
  ): Promise<TeePageQuery<TeeLog[]>>;

  abstract addAgent(agent: TeeAgent): Promise<boolean>;

  abstract getAgent(agentId: string): Promise<TeeAgent>;

  abstract getAllAgents(): Promise<TeeAgent[]>;
}

export enum TEEMode {
  OFF = "OFF",
  LOCAL = "LOCAL", // For local development with simulator
  DOCKER = "DOCKER", // For docker development with simulator
  PRODUCTION = "PRODUCTION", // For production without simulator
}

export interface RemoteAttestationQuote {
  quote: string;
  timestamp: number;
}

export interface DeriveKeyAttestationData {
  agentId: string;
  publicKey: string;
  subject?: string;
}

export interface RemoteAttestationMessage {
  agentId: string;
  timestamp: number;
  message: {
    userId: string;
    roomId: string;
    content: string;
  };
}

export interface SgxAttestation {
  quote: string;
  timestamp: number;
}

export enum TeeType {
  SGX_GRAMINE = "sgx_gramine",
  TDX_DSTACK = "tdx_dstack",
}

export interface TeeVendorConfig {
  // Add vendor-specific configuration options here
  [key: string]: unknown;
}

export interface TeePluginConfig {
  vendor?: string;
  vendorConfig?: TeeVendorConfig;
}

export interface Task {
  id?: UUID;
  name: string;
  metadata?: {
    updatedAt?: number;
    updateInterval?: number;
    options?: {
      name: string;
      description: string;
    }[];
    [key: string]: unknown;
  };
  description: string;
  roomId?: UUID;
  worldId?: UUID;
  tags: string[];
  handler: (runtime: IAgentRuntime, options: { [key: string]: unknown }) => Promise<void>;
  validate?: (runtime: IAgentRuntime, message: Memory, state: State) => Promise<boolean>;
}

export type WorldData = {
  id: UUID;
  name: string;
  agentId: UUID;
  serverId: string;
  metadata?: {
    ownership?: {
      ownerId: string;
    };
    roles?: {
      [userId: UUID]: RoleName;
    };
    [key: string]: unknown;
  };
}

export type RoomData = {
  id: UUID;
  name?: string;
  agentId?: UUID;
  source: string;
  type: ChannelType;
  channelId?: string;
  serverId?: string;
  worldId?: UUID;
  metadata?: Record<string, unknown>;
}

export enum RoleName {
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  NONE = "NONE"
}

export interface OnboardingSetting {
  name: string;
  description: string;         // Used in chat context when discussing the setting
  usageDescription: string;    // Used during settings to guide users
  value: string | boolean | null;
  required: boolean;
  public?: boolean;           // If true, shown in public channels
  secret?: boolean;           // If true, value is masked and only shown during settings
  validation?: (value: any) => boolean;
  dependsOn?: string[];
  onSetAction?: (value: any) => string;
  visibleIf?: (settings: { [key: string]: OnboardingSetting }) => boolean;
}

export interface WorldSettings {
  [key: string]: OnboardingSetting;
}

export interface OnboardingConfig {
  settings: { 
      [key: string]: Omit<OnboardingSetting, 'value'>; 
  };
}

/**
 * Send a direct message to a user
 * @param runtime The agent runtime instance
 * @param targetEntityId The ID of the user to send the message to
 * @param source The platform/source to send on (e.g. telegram, discord)
 * @param message The message content to send
 * @param worldId The world ID context
 */
export async function sendDirectMessage(
  runtime: IAgentRuntime,
  targetEntityId: UUID,
  source: string,
  message: string,
  worldId: UUID
): Promise<void> {
  const client = runtime.getClient(source);
  if (!client) {
    throw new Error(`No client found for source: ${source}`);
  }
  
  await client.sendDirectMessage?.(targetEntityId, message, worldId);
}

/**
 * Send a message to a room
 * @param runtime The agent runtime instance
 * @param roomId The ID of the room to send to
 * @param source The platform/source to send on (e.g. telegram, discord)
 * @param message The message content to send
 * @param worldId The world ID context
 */
export async function sendRoomMessage(
  runtime: IAgentRuntime,
  roomId: UUID,
  source: string,
  message: string,
  worldId: UUID
): Promise<void> {
  const client = runtime.getClient(source);
  if (!client) {
    throw new Error(`No client found for source: ${source}`);
  }
  
  await client.sendRoomMessage?.(roomId, message, worldId);
}