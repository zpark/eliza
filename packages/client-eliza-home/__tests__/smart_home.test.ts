import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SmartHomeManager } from '../src/smart_home';
import { SmartThingsApi } from '../src/services/smart_things_api';
import { CommandParser } from '../src/utils/command_parser';
import type { IAgentRuntime } from '@elizaos/core';

// Mock dependencies
vi.mock('../src/services/smart_things_api', () => ({
    SmartThingsApi: vi.fn().mockImplementation(() => ({
        devices: {
            list: vi.fn().mockResolvedValue([]),
            executeCommand: vi.fn().mockResolvedValue({ status: 'success' })
        }
    }))
}));
vi.mock('../src/utils/command_parser');
vi.mock('@elizaos/core', () => ({
    elizaLogger: {
        error: vi.fn(),
    },
}));

describe('SmartHomeManager', () => {
    let smartHomeManager: SmartHomeManager;
    let mockRuntime: IAgentRuntime;

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();

        // Create mock runtime
        mockRuntime = {
            llm: {
                shouldRespond: vi.fn(),
                complete: vi.fn(),
            },
            getSetting: vi.fn().mockReturnValue('mock-token'),
            composeState: vi.fn(),
            updateRecentMessageState: vi.fn(),
        } as unknown as IAgentRuntime;

        smartHomeManager = new SmartHomeManager(mockRuntime);
    });

    describe('handleCommand', () => {
        it('should return null when shouldRespond returns IGNORE', async () => {
            // Arrange
            vi.mocked(mockRuntime.llm.shouldRespond).mockResolvedValue('IGNORE');

            // Act
            const result = await smartHomeManager.handleCommand('turn on lights', 'user123');

            // Assert
            expect(result).toBeNull();
            expect(mockRuntime.llm.shouldRespond).toHaveBeenCalled();
            expect(CommandParser.parseCommand).not.toHaveBeenCalled();
        });

        it('should successfully handle a valid command', async () => {
            // Arrange
            const mockCommand = 'turn on lights';
            const mockUserId = 'user123';
            const mockParsedCommand = {
                command: 'turnOn',
                args: { device: 'lights' }
            };
            const mockDeviceCommand = {
                deviceId: 'device123',
                capability: 'switch',
                command: 'on',
                arguments: []
            };
            const mockApiResponse = { status: 'success' };
            const mockDevices = [
                { name: 'Light', status: { switch: 'on' } }
            ];

            vi.mocked(mockRuntime.llm.shouldRespond).mockResolvedValue('RESPOND');
            vi.mocked(CommandParser.parseCommand).mockReturnValue(mockParsedCommand);
            vi.mocked(CommandParser.mapToDeviceCommand).mockReturnValue(mockDeviceCommand);
            vi.mocked(mockRuntime.llm.complete).mockResolvedValue('Command executed successfully');

            // Mock SmartThingsApi
            const mockApi = vi.mocked(SmartThingsApi).mock.results[0].value;
            mockApi.devices.executeCommand.mockResolvedValue(mockApiResponse);
            mockApi.devices.list.mockResolvedValue(mockDevices);

            // Act
            const result = await smartHomeManager.handleCommand(mockCommand, mockUserId);

            // Assert
            expect(result).toEqual({
                success: true,
                message: 'Command executed successfully',
                data: mockApiResponse
            });
            expect(mockRuntime.llm.shouldRespond).toHaveBeenCalled();
            expect(CommandParser.parseCommand).toHaveBeenCalledWith(mockCommand);
            expect(CommandParser.mapToDeviceCommand).toHaveBeenCalledWith(
                mockParsedCommand.command,
                mockParsedCommand.args
            );
            expect(mockRuntime.llm.complete).toHaveBeenCalled();
        });

        it('should handle errors appropriately', async () => {
            // Arrange
            const mockError = new Error('API Error');
            vi.mocked(mockRuntime.llm.shouldRespond).mockResolvedValue('RESPOND');
            vi.mocked(CommandParser.parseCommand).mockImplementation(() => {
                throw mockError;
            });

            // Act & Assert
            await expect(
                smartHomeManager.handleCommand('turn on lights', 'user123')
            ).rejects.toThrow(mockError);
        });
    });
});
