import { describe, expect, it, vi, beforeEach } from 'vitest';
import { goalEvaluator } from '../../src/evaluators/goal';
import { composeContext, generateText, getGoals, parseJsonArrayFromText, ModelClass, type Goal, GoalStatus } from '@elizaos/core';

vi.mock('@elizaos/core', () => ({
    composeContext: vi.fn(),
    generateText: vi.fn(),
    getGoals: vi.fn(),
    parseJsonArrayFromText: vi.fn(),
    ModelClass: {
        LARGE: 'large'
    },
    GoalStatus: {
        IN_PROGRESS: 'IN_PROGRESS',
        DONE: 'DONE'
    }
}));

describe('goalEvaluator', () => {
    let mockRuntime;
    let mockMessage;

    const TEST_ROOM_ID = 'test-room-0000-0000-0000-000000000000';
    const TEST_USER_ID = 'test-user-0000-0000-0000-000000000000';
    const TEST_GOAL_ID = 'goal-0000-0000-0000-0000-000000000000';
    const TEST_GOAL_ID_2 = 'goal-1111-1111-1111-1111-111111111111';

    beforeEach(() => {
        mockRuntime = {
            character: {
                settings: {},
                templates: {
                    goalsTemplate: 'custom template'
                }
            },
            messageManager: {
                countMemories: vi.fn().mockResolvedValue(5)
            },
            composeState: vi.fn().mockResolvedValue({
                agentId: 'test-agent',
                roomId: TEST_ROOM_ID,
                goals: [{ id: TEST_GOAL_ID, name: 'Test Goal' }]
            }),
            getConversationLength: vi.fn().mockReturnValue(10),
            databaseAdapter: {
                updateGoal: vi.fn().mockResolvedValue(true)
            }
        };

        mockMessage = {
            content: {
                text: 'I have completed the project documentation.'
            },
            roomId: TEST_ROOM_ID
        };

        // Reset all mocks
        vi.clearAllMocks();
    });

    describe('validation', () => {
        it('should validate successfully with active goals', async () => {
            vi.mocked(getGoals).mockImplementation(async ({ runtime, roomId, onlyInProgress }) => {
                expect(runtime).toBe(mockRuntime);
                expect(roomId).toBe(TEST_ROOM_ID);
                expect(onlyInProgress).toBe(true);
                return [{
                    id: TEST_GOAL_ID,
                    name: 'Test Goal',
                    status: GoalStatus.IN_PROGRESS,
                    roomId: TEST_ROOM_ID,
                    userId: TEST_USER_ID,
                    objectives: []
                }];
            });

            const result = await goalEvaluator.validate(mockRuntime, mockMessage);
            expect(result).toBe(true);
            expect(getGoals).toHaveBeenCalledWith({
                runtime: mockRuntime,
                count: 1,
                onlyInProgress: true,
                roomId: TEST_ROOM_ID
            });
        });

        it('should fail validation when no active goals exist', async () => {
            vi.mocked(getGoals).mockResolvedValue([]);
            const result = await goalEvaluator.validate(mockRuntime, mockMessage);
            expect(result).toBe(false);
        });
    });

    describe('evaluator properties', () => {
        it('should have correct evaluator properties', () => {
            expect(goalEvaluator.name).toBe('UPDATE_GOAL');
            expect(goalEvaluator.similes).toContain('UPDATE_GOALS');
            expect(goalEvaluator.description).toBeDefined();
            expect(goalEvaluator.description).toContain('Analyze the conversation');
            expect(goalEvaluator.examples).toBeDefined();
            expect(Array.isArray(goalEvaluator.examples)).toBe(true);
        });

        it('should have valid examples with required properties', () => {
            goalEvaluator.examples.forEach(example => {
                expect(example).toHaveProperty('context');
                expect(example).toHaveProperty('messages');
                expect(example).toHaveProperty('outcome');
                expect(Array.isArray(example.messages)).toBe(true);
                expect(typeof example.context).toBe('string');
                expect(typeof example.outcome).toBe('string');
            });
        });
    });

    describe('goal updates', () => {
        it('should handle goal updates with custom template', async () => {
            const mockGoals: Goal[] = [
                {
                    id: TEST_GOAL_ID,
                    name: 'Complete Project Documentation',
                    status: GoalStatus.IN_PROGRESS,
                    roomId: TEST_ROOM_ID,
                    userId: TEST_USER_ID,
                    objectives: [
                        {
                            description: 'Write project overview',
                            completed: true
                        },
                        {
                            description: 'Document API endpoints',
                            completed: false
                        }
                    ]
                }
            ];

            const mockUpdatedGoals: Goal[] = [
                {
                    id: TEST_GOAL_ID,
                    name: 'Complete Project Documentation',
                    status: GoalStatus.DONE,
                    roomId: TEST_ROOM_ID,
                    userId: TEST_USER_ID,
                    objectives: [
                        {
                            description: 'Write project overview',
                            completed: true
                        },
                        {
                            description: 'Document API endpoints',
                            completed: true
                        }
                    ]
                }
            ];

            // Create a deep copy of the expected result without the id
            // since the handler function removes the id before returning
            const expectedResult = JSON.parse(JSON.stringify(mockUpdatedGoals));
            delete expectedResult[0].id;

            vi.mocked(composeContext).mockReturnValue('mock-context');
            vi.mocked(getGoals).mockResolvedValue(mockGoals);
            vi.mocked(generateText).mockResolvedValue(JSON.stringify(mockUpdatedGoals));
            vi.mocked(parseJsonArrayFromText).mockReturnValue(mockUpdatedGoals);

            const result = await goalEvaluator.handler(mockRuntime, mockMessage);

            expect(composeContext).toHaveBeenCalledWith({
                state: expect.any(Object),
                template: 'custom template'
            });
            expect(getGoals).toHaveBeenCalledWith({
                runtime: mockRuntime,
                roomId: TEST_ROOM_ID,
                onlyInProgress: true
            });
            expect(generateText).toHaveBeenCalledWith({
                runtime: mockRuntime,
                context: 'mock-context',
                modelClass: ModelClass.LARGE
            });
            
            // The updateGoal call should match exactly what's in the source code
            expect(mockRuntime.databaseAdapter.updateGoal).toHaveBeenCalledWith({
                id: TEST_GOAL_ID,
                name: 'Complete Project Documentation',
                status: GoalStatus.DONE,
                roomId: TEST_ROOM_ID,
                userId: TEST_USER_ID,
                objectives: mockUpdatedGoals[0].objectives
            });
            
            // Check that the result matches our expected result (without id)
            expect(result).toEqual(expectedResult);
        });

        it('should handle goal updates with default template', async () => {
            mockRuntime.character.templates = {};
            const mockGoals: Goal[] = [
                {
                    id: TEST_GOAL_ID,
                    name: 'Test Goal',
                    status: GoalStatus.IN_PROGRESS,
                    roomId: TEST_ROOM_ID,
                    userId: TEST_USER_ID,
                    objectives: [{ description: 'Test objective', completed: false }]
                }
            ];

            vi.mocked(getGoals).mockResolvedValue(mockGoals);
            vi.mocked(generateText).mockResolvedValue('[]');
            vi.mocked(parseJsonArrayFromText).mockReturnValue([]);

            await goalEvaluator.handler(mockRuntime, mockMessage);

            expect(composeContext).toHaveBeenCalledWith({
                state: expect.any(Object),
                template: expect.stringContaining('TASK: Update Goal')
            });
        });

        it('should handle partial goal updates', async () => {
            const mockGoals: Goal[] = [
                {
                    id: TEST_GOAL_ID,
                    name: 'Task 1',
                    status: GoalStatus.IN_PROGRESS,
                    roomId: TEST_ROOM_ID,
                    userId: TEST_USER_ID,
                    objectives: [
                        { description: 'Obj 1', completed: false },
                        { description: 'Obj 2', completed: false }
                    ]
                },
                {
                    id: TEST_GOAL_ID_2,
                    name: 'Task 2',
                    status: GoalStatus.IN_PROGRESS,
                    roomId: TEST_ROOM_ID,
                    userId: TEST_USER_ID,
                    objectives: [
                        { description: 'Obj 3', completed: false }
                    ]
                }
            ];

            const mockUpdates: Goal[] = [
                {
                    id: TEST_GOAL_ID,
                    name: 'Task 1',
                    status: GoalStatus.IN_PROGRESS,
                    roomId: TEST_ROOM_ID,
                    userId: TEST_USER_ID,
                    objectives: [
                        { description: 'Obj 1', completed: true },
                        { description: 'Obj 2', completed: false }
                    ]
                }
            ];

            // Create a deep copy of the expected result without the id
            const expectedResult = JSON.parse(JSON.stringify(mockUpdates));
            delete expectedResult[0].id;

            vi.mocked(getGoals).mockResolvedValue(mockGoals);
            vi.mocked(generateText).mockResolvedValue(JSON.stringify(mockUpdates));
            vi.mocked(parseJsonArrayFromText).mockReturnValue(mockUpdates);

            const result = await goalEvaluator.handler(mockRuntime, mockMessage) as Goal[];

            expect(result).toHaveLength(1);
            expect(result[0].objectives[0].completed).toBe(true);
            expect(result[0].objectives[1].completed).toBe(false);
            expect(mockRuntime.databaseAdapter.updateGoal).toHaveBeenCalledTimes(1);
            expect(result).toEqual(expectedResult);
        });

        it('should handle empty update response', async () => {
            const mockGoals: Goal[] = [
                {
                    id: TEST_GOAL_ID,
                    name: 'Task 1',
                    status: GoalStatus.IN_PROGRESS,
                    roomId: TEST_ROOM_ID,
                    userId: TEST_USER_ID,
                    objectives: [{ description: 'Obj 1', completed: false }]
                }
            ];

            vi.mocked(getGoals).mockResolvedValue(mockGoals);
            vi.mocked(generateText).mockResolvedValue('[]');
            vi.mocked(parseJsonArrayFromText).mockReturnValue([]);

            const result = await goalEvaluator.handler(mockRuntime, mockMessage) as Goal[];

            expect(result).toHaveLength(0);
            expect(mockRuntime.databaseAdapter.updateGoal).not.toHaveBeenCalled();
        });
    });
});
