import { 
  type IAgentRuntime, 
  ModelClass, 
  type Character,
  type IMemoryManager,
  type ICacheManager,
  type State,
  type IDatabaseAdapter
} from '@elizaos/core';
import path from 'node:path';
import { vi } from 'vitest';
import { MODEL_SPECS } from '../src/types';

// Get the workspace root by going up from the current file location
const WORKSPACE_ROOT = path.resolve(__dirname, '../../../');

// During tests, we need to set cwd to agent directory since that's where the plugin runs from in production
const AGENT_DIR = path.join(WORKSPACE_ROOT, 'packages/agent');
process.chdir(AGENT_DIR);

// Create shared mock for download manager
export const downloadModelMock = vi.fn().mockResolvedValue(undefined);

export const TEST_PATHS = {
  MODELS_DIR: path.join(AGENT_DIR, 'models'),
  CACHE_DIR: path.join(AGENT_DIR, 'cache')
} as const;

export const createMockRuntime = (): IAgentRuntime => ({
  agentId: '12345678-1234-1234-1234-123456789012',
  databaseAdapter: {} as IDatabaseAdapter,
  adapters: [],
  character: {} as Character,
  providers: [],
  actions: [],
  evaluators: [],
  plugins: [],
  fetch: null,
  routes: [],
  messageManager: {} as IMemoryManager,
  descriptionManager: {} as IMemoryManager,
  documentsManager: {} as IMemoryManager,
  knowledgeManager: {} as IMemoryManager,
  cacheManager: {} as ICacheManager,
  getClient: () => null,
  getAllClients: () => new Map(),
  registerClient: () => {},
  unregisterClient: () => {},
  initialize: async () => {},
  registerMemoryManager: () => {},
  getMemoryManager: () => null,
  getService: () => null,
  registerService: () => {},
  setSetting: () => {},
  getSetting: () => null,
  getConversationLength: () => 0,
  processActions: async () => {},
  evaluate: async () => null,
  ensureParticipantExists: async () => {},
  ensureUserExists: async () => {},
  registerProvider: () => {},
  registerAction: () => {},
  ensureConnection: async () => {},
  ensureParticipantInRoom: async () => {},
  ensureRoomExists: async () => {},
  composeState: async () => ({} as State),
  updateRecentMessageState: async (state) => state,
  useModel: async <T>(modelClass: ModelClass, _params: T): Promise<string> => {
    // Check if there are any pending mock rejections
    const mockCalls = downloadModelMock.mock.calls;
    if (mockCalls.length > 0 && downloadModelMock.mock.results[mockCalls.length - 1].type === 'throw') {
      // Rethrow the error from the mock
      throw downloadModelMock.mock.results[mockCalls.length - 1].value;
    }

    // Call downloadModel based on the model class
    if (modelClass === ModelClass.TEXT_SMALL) {
      await downloadModelMock(MODEL_SPECS.small, path.join(TEST_PATHS.MODELS_DIR, MODEL_SPECS.small.name));
      return "This is a test response from the small model.";
    }
    if (modelClass === ModelClass.TEXT_LARGE) {
      await downloadModelMock(MODEL_SPECS.medium, path.join(TEST_PATHS.MODELS_DIR, MODEL_SPECS.medium.name));
      return "Artificial intelligence is a transformative technology that continues to evolve.";
    }
    throw new Error(`Unexpected model class: ${modelClass}`);
  },
  registerModel: () => {},
  getModel: () => undefined,
  registerEvent: () => {},
  getEvent: () => undefined,
  emitEvent: () => {},
  registerTask: () => '12345678-1234-1234-1234-123456789012',
  getTasks: () => undefined,
  getTask: () => undefined,
  updateTask: () => {},
  deleteTask: () => {},
  stop: async () => {}
}); 