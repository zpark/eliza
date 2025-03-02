import type { Character, Content, IAgentRuntime, Memory } from '@elizaos/core';
import { ChannelType, composeContext, createUniqueUuid, generateMessageResponse, logger, messageHandlerTemplate, ModelClass, stringToUuid, validateCharacterConfig, validateUuid } from '@elizaos/core';
import express, { type Request, type RequestHandler, type Response } from 'express';
import fs from 'node:fs';
import type { AgentServer } from '..';
import { upload } from '../loader';

// Request/Response Types
interface CustomRequest extends express.Request {
    file?: Express.Multer.File;
    params: {
        agentId: string;
    };
}

interface AgentResponse {
    id: string;
    enabled?: boolean;
    character: Character;
    status?: 'active' | 'inactive';
}


interface RoomResponse {
    id: string;
    name: string;
    source: string;
    worldId?: string;
    createdAt?: number;
}

export function agentRouter(
    agents: Map<string, IAgentRuntime>,
    server?: AgentServer
): express.Router {
    const router = express.Router();

    // ===== Utility Functions =====

    const validateAgentAndGetRuntime = async (req: Request, res: Response): Promise<IAgentRuntime | null> => {
        const agentId = validateUuid(req.params.agentId);
        if (!agentId) {
            logger.warn("[API] Invalid agent ID format");
            res.status(400).json({ error: "Invalid agent ID format" });
            return null;
        }

        let runtime = agents.get(agentId);
        if (!runtime) {
            runtime = Array.from(agents.values()).find(
                (a) => a.character.name.toLowerCase() === agentId.toLowerCase()
            );
        }

        if (!runtime) {
            logger.warn(`[API] Agent not found: ${agentId}`);
            res.status(404).json({ error: "Agent not found" });
            return null;
        }

        return runtime;
    };

    const handleApiError = (res: Response, error: Error, context: string): void => {
        logger.error(`[${context}] Error:`, error);
        res.status(500).json({
            error: `Error in ${context}`,
            details: error.message
        });
    };

    const createMessageContent = (text: string): Content => ({
        text,
        attachments: [],
        source: "direct",
        inReplyTo: undefined,
    });

    interface ConnectionData {
        userName?: string;
        userScreenName?: string;
        worldId?: string;
    }

    const createMemory = (
        runtime: IAgentRuntime,
        userId: string,
        roomId: string,
        content: Content
    ): Memory => ({
        id: createUniqueUuid(runtime, Date.now().toString()),
        agentId: runtime.agentId,
        userId: validateUuid(userId),
        roomId: validateUuid(roomId),
        content,
        createdAt: Date.now(),
    });

    const ensureAgentConnection = async (
        runtime: IAgentRuntime,
        userId: string,
        roomId: string,
        additionalData?: ConnectionData
    ): Promise<void> => {
        await runtime.ensureConnection({
            userId: validateUuid(userId),
            roomId: validateUuid(roomId),
            userName: additionalData?.userName,
            userScreenName: additionalData?.userScreenName,
            source: "direct",
            type: ChannelType.API,
            worldId: validateUuid(additionalData?.worldId),
        });
    };

    const createRoomResponse = (
        roomId: string,
        name: string,
        source = "client",
        worldId?: string
    ): RoomResponse => ({
        id: validateUuid(roomId) || roomId,
        name: name || new Date().toLocaleString(),
        source,
        worldId,
        createdAt: Date.now()
    });

    // ===== Core Agent CRUD Operations =====

    // List all agents
    router.get('/', (async (req: Request, res: Response) => {
        logger.debug("[AGENTS LIST] Retrieving list of all agents");
        try {
            const agents = await server?.database.getAgents();
            res.status(200).json({ agents });
        } catch (error) {
            logger.error("[AGENTS LIST] Error retrieving agents:", error);
            res.status(500).json({ error: "Failed to retrieve agents" });
        }
    }) as RequestHandler);

    // Get specific agent
    router.get('/:agentId', (async (req: Request, res: Response) => {
        if (!req.params.agentId) {
            logger.warn("[AGENT GET] Invalid agent ID format");
            res.status(400).json({ error: "Invalid agent ID format" });
            return;
        }

        const agentId = validateUuid(req.params.agentId);
        if (!agentId) {
            logger.warn("[AGENT GET] Invalid agent ID format");
            res.status(400).json({ error: "Invalid agent ID format" });
            return;
        }

        logger.info(`[AGENT GET] Retrieving information for agent: ${agentId}`);
        try {
            const agent = await server?.database.getAgent(agentId);

            if (!agent) {
                logger.warn(`[AGENT GET] Agent not found: ${agentId}`);
                res.status(404).json({ error: 'Agent not found' });
                return;
            }

            const response: AgentResponse = {
                id: agentId,
                enabled: agent.enabled,
                character: agent.character,
            };

            res.status(200).json(response);
            logger.debug(`[AGENT GET] Successfully returned agent data for: ${agent.character.name}`);
        } catch (error) {
            logger.error(`[AGENT GET] Error retrieving agent: ${error}`);
            res.status(500).json({ error: "Failed to retrieve agent" });
        }
    }) as RequestHandler);

    // Create new agent
    router.post('/', (async (req: Request, res: Response) => {
        logger.info("[AGENT CREATE] Received request to create a new agent");
        const { characterPath, characterJson, remotePath } = req.body;

        try {
            let character: Character;

            if (remotePath) {
                logger.debug("[AGENT CREATE] Loading character from remote path: ${remotePath}");
                character = await server?.loadCharacterTryPath(remotePath);
            } else if (characterJson) {
                logger.debug("[AGENT CREATE] Parsing character from JSON");
                character = await server?.jsonToCharacter(characterJson);
            } else if (characterPath) {
                logger.debug(`[AGENT CREATE] Loading character from path: ${characterPath}`);
                character = await server?.loadCharacterTryPath(characterPath);
            } else {
                logger.warn("[AGENT CREATE] No character configuration provided");
                res.status(400).json({ error: "Must provide either characterPath or characterJson" });
                return;
            }

            if (!character) {
                const errorMessage = "Failed to load character configuration";
                logger.error(`[AGENT CREATE] ${errorMessage}`);
                res.status(400).json({ error: errorMessage });
                return;
            }

            logger.info(`[AGENT CREATE] Starting agent for character: ${character.name}`);
            const agent = await server?.startAgent(character);
            logger.success(`[AGENT CREATE] Agent created successfully: ${character.name} (${character.id})`);

            const response: AgentResponse = {
                id: agent.agentId,
                character: agent.character,
                status: 'active'
            };

            res.status(201).json(response);
        } catch (e) {
            logger.error(`[AGENT CREATE] Error creating agent: ${e}`);
            res.status(500).json({
                error: "Failed to create agent",
                details: e.message
            });
        }
    }) as RequestHandler);

    // Update agent
    router.put('/:agentId', (async (req: Request, res: Response) => {
        const agentId = validateUuid(req.params.agentId);

        if (!agentId) {
            logger.warn("[AGENT UPDATE] Invalid agent ID format");
            res.status(400).json({ error: "Invalid agent ID format" });
            return;
        }

        logger.info(`[AGENT UPDATE] Request to update agent: ${agentId}`);
        let agent: IAgentRuntime = agents.get(agentId);

        if (!agent) {
            logger.warn(`[AGENT UPDATE] Agent not found: ${agentId}`);
            res.status(404).json({ error: "Agent not found" });
            return;
        }

        const character = req.body;
        logger.debug("[AGENT UPDATE] Validating character configuration");
        try {
            validateCharacterConfig(character);
            logger.debug(`[AGENT UPDATE] Character configuration valid for: ${character.name}`);
        } catch (e) {
            logger.error("[AGENT UPDATE] Error validating character configuration:", e);
            res.status(400).json({
                error: "Invalid character configuration",
                details: e.message
            });
            return;
        }

        try {
            // Stop existing agent
            const existingName = agent.character.name;
            logger.info(`[AGENT UPDATE] Stopping existing agent: ${existingName} (${agentId})`);
            await agent.stop();
            logger.success(`[AGENT UPDATE] Successfully stopped existing agent: ${existingName}`);
            server?.unregisterAgent(agent);
            logger.success(`[AGENT UPDATE] Successfully unregistered existing agent: ${existingName}`);

            // Start updated agent
            logger.info(`[AGENT UPDATE] Starting updated agent: ${character.name}`);
            agent = await server?.startAgent(character);
            await agent.ensureCharacterExists(character);
            logger.success(`[AGENT UPDATE] Agent successfully updated and started: ${character.name} (${character.id})`);

            const response: AgentResponse = {
                id: character.id,
                character: character,
                status: 'active'
            };

            res.status(200).json(response);
        } catch (e) {
            logger.error("[AGENT UPDATE] Error updating agent:", e);
            res.status(500).json({
                error: "Failed to update agent",
                details: e.message
            });
        }
    }) as RequestHandler);

    // Delete agent
    router.delete('/:agentId', (async (req: Request, res: Response) => {
        const agentId = validateUuid(req.params.agentId);

        if (!agentId) {
            logger.warn("[AGENT DELETE] Invalid agent ID format");
            res.status(400).json({ error: "Invalid agent ID format" });
            return;
        }

        logger.info(`[AGENT DELETE] Request to delete agent: ${agentId}`);
        const agent: IAgentRuntime = agents.get(agentId);

        if (!agent) {
            logger.warn(`[AGENT DELETE] Agent not found: ${agentId}`);
            res.status(404).json({ error: "Agent not found" });
            return;
        }

        try {
            const agentName = agent.character.name;
            logger.info(`[AGENT DELETE] Stopping agent: ${agentName} (${agentId})`);

            await agent.stop();
            logger.success(`[AGENT DELETE] Agent stopped: ${agentName}`);

            server?.unregisterAgent(agent);
            logger.success(`[AGENT DELETE] Agent unregistered: ${agentName}`);

            res.status(204).send();
            logger.info(`[AGENT DELETE] Successfully deleted agent: ${agentName} (${agentId})`);
        } catch (error) {
            logger.error(`[AGENT DELETE] Error deleting agent: ${agent.character.name}`, error);
            res.status(500).json({
                error: 'Error deleting agent',
                details: error.message
            });
        }
    }) as RequestHandler);

    // ===== Agent Status Management =====

    // Update agent status
    router.patch('/:agentId/status', (async (req: Request, res: Response) => {
        const agentId = validateUuid(req.params.agentId);
        if (!agentId) {
            logger.warn("[STATUS] Invalid agent ID format");
            res.status(400).json({ error: "Invalid agent ID format" });
            return;
        }

        const { status } = req.body;
        if (!status || !['active', 'inactive'].includes(status)) {
            logger.warn("[STATUS] Invalid status value");
            res.status(400).json({ error: "Status must be 'active' or 'inactive'" });
            return;
        }

        try {
            if (status === 'active') {
                // Start agent
                logger.info(`[STATUS] Starting agent: ${agentId}`);
                const character = await server?.database.getCharacter(agentId);
                if (!character) {
                    logger.warn(`[STATUS] Character not found: ${agentId}`);
                    res.status(404).json({ error: "Character not found" });
                    return;
                }

                const agent = await server?.startAgent(character);
                logger.success(`[STATUS] Agent started: ${character.name} (${agentId})`);

                const response: AgentResponse = {
                    id: agent.agentId,
                    character: agent.character,
                    status: 'active'
                };
                res.status(200).json(response);
            } else {
                // Stop agent
                const agent = agents.get(agentId);
                if (!agent) {
                    logger.warn(`[STATUS] Agent not found: ${agentId}`);
                    res.status(404).json({ error: "Agent not found" });
                    return;
                }

                const agentName = agent.character.name;
                logger.info(`[STATUS] Stopping agent: ${agentName} (${agentId})`);

                await agent.stop();
                server?.unregisterAgent(agent);
                logger.success(`[STATUS] Agent stopped: ${agentName} (${agentId})`);

                const response: AgentResponse = {
                    id: agentId,
                    character: agent.character,
                    status: 'inactive'
                };
                res.status(200).json(response);
            }
        } catch (error) {
            logger.error("[STATUS] Error updating agent status:", error);
            res.status(500).json({
                error: "Error updating agent status",
                details: error.message
            });
        }
    }) as RequestHandler);

    // ===== Communication (Messages & Speech) =====

    // Send message to agent
    router.post('/:agentId/messages', (async (req: CustomRequest, res: Response) => {
        const runtime = await validateAgentAndGetRuntime(req, res);
        if (!runtime) return;

        const text = req.body?.text?.trim();
        if (!text) {
            logger.warn("[MESSAGE] No text provided");
            res.status(400).json({ error: "Text message is required" });
            return;
        }

        try {
            const roomId = createUniqueUuid(runtime, req.body.roomId ?? `default-room-${runtime.agentId}`);
            const userId = createUniqueUuid(runtime, req.body.userId ?? "user");

            await ensureAgentConnection(runtime, userId, roomId, {
                userName: req.body.userName,
                userScreenName: req.body.name,
                worldId: req.body.worldId
            });

            const content = createMessageContent(text);
            const memory = createMemory(runtime, userId, roomId, content);

            await runtime.messageManager.createMemory(memory);
            let state = await runtime.composeState({
                content,
                userId,
                roomId,
                agentId: runtime.agentId
            }, {
                agentName: runtime.character.name,
            });

            const context = composeContext({
                state,
                template: messageHandlerTemplate,
            });

            const response = await generateMessageResponse({
                runtime: runtime,
                context,
                modelClass: ModelClass.TEXT_LARGE,
            });

            if (!response) {
                res.status(500).json({ error: "No response from agent" });
                return;
            }

            const responseMessage: Memory = {
                id: createUniqueUuid(runtime, memory.id),
                agentId: runtime.agentId,
                userId: runtime.agentId,
                roomId,
                content: response,
                createdAt: Date.now(),
            };

            await runtime.messageManager.createMemory(responseMessage);
            state = await runtime.updateRecentMessageState(state);

            await runtime.processActions(
                memory,
                [responseMessage],
                state,
                async (message: Content) => {
                    res.status(201).json([message]);
                    return [memory];
                }
            );

            await runtime.evaluate(memory, state);
        } catch (error) {
            handleApiError(res, error, "MESSAGE");
        }
    }) as RequestHandler);

    // Generate speech
    router.post('/:agentId/speech/generate', (async (req: CustomRequest, res: Response) => {
        const agentId = validateUuid(req.params.agentId);
        if (!agentId) {
            logger.warn("[SPEECH] Invalid agent ID format");
            res.status(400).json({ error: "Invalid agent ID format" });
            return;
        }

        const { text } = req.body;
        if (!text) {
            logger.warn("[SPEECH] No text provided");
            res.status(400).json({ error: "Text is required" });
            return;
        }

        let runtime = agents.get(agentId);
        if (!runtime) {
            runtime = Array.from(agents.values()).find(
                (a) => a.character.name.toLowerCase() === agentId.toLowerCase()
            );
        }

        if (!runtime) {
            logger.warn(`[SPEECH] Agent not found: ${agentId}`);
            res.status(404).json({ error: "Agent not found" });
            return;
        }

        try {
            logger.info("[SPEECH] Using text-to-speech model to generate audio");
            const speechResponse = await runtime.useModel(ModelClass.TEXT_TO_SPEECH, text);
            const audioBuffer = await speechResponse.arrayBuffer();

            res.set({
                "Content-Type": "audio/mpeg",
                "Transfer-Encoding": "chunked",
            });

            res.send(Buffer.from(audioBuffer));
            logger.success(`[SPEECH] Successfully generated speech for: ${runtime.character.name}`);
        } catch (error) {
            logger.error("[SPEECH] Error generating speech:", error);
            res.status(500).json({
                error: "Error generating speech",
                details: error.message,
            });
        }
    }) as RequestHandler);

    // Process speech with conversation
    router.post('/:agentId/speech/conversation', (async (req: CustomRequest, res: Response) => {
        const agentId = validateUuid(req.params.agentId);
        if (!agentId) {
            logger.warn("[SPEECH] Invalid agent ID format");
            res.status(400).json({ error: "Invalid agent ID format" });
            return;
        }

        const { text } = req.body;
        if (!text) {
            logger.warn("[SPEECH] No text provided");
            res.status(400).json({ error: "Text is required" });
            return;
        }

        let runtime = agents.get(agentId);
        if (!runtime) {
            runtime = Array.from(agents.values()).find(
                (a) => a.character.name.toLowerCase() === agentId.toLowerCase()
            );
        }

        if (!runtime) {
            logger.warn(`[SPEECH] Agent not found: ${agentId}`);
            res.status(404).json({ error: "Agent not found" });
            return;
        }

        try {
            const { roomId: rawRoomId, userId: rawUserId } = req.body;
            const roomId = createUniqueUuid(runtime, rawRoomId ?? `default-room-${agentId}`);
            const userId = createUniqueUuid(runtime, rawUserId ?? "user");

            await runtime.ensureConnection({
                userId,
                roomId,
                userName: req.body.userName,
                userScreenName: req.body.name,
                source: "direct",
                type: ChannelType.API,
            });

            const messageId = stringToUuid(Date.now().toString());
            const content: Content = {
                text,
                attachments: [],
                source: "direct",
                inReplyTo: undefined,
            };

            const userMessage = {
                content,
                userId,
                roomId,
                agentId: runtime.agentId,
            };

            const memory: Memory = {
                id: messageId,
                agentId: runtime.agentId,
                userId,
                roomId,
                content,
                createdAt: Date.now(),
            };

            await runtime.messageManager.createMemory(memory);
            const state = await runtime.composeState(userMessage, {
                agentName: runtime.character.name,
            });

            const context = composeContext({
                state,
                template: messageHandlerTemplate,
            });

            const response = await runtime.useModel(ModelClass.TEXT_LARGE, {
                messages: [{
                    role: 'system',
                    content: messageHandlerTemplate
                }, {
                    role: 'user',
                    content: context
                }]
            });

            if (!response) {
                logger.error("[SPEECH] No response received from LLM");
                res.status(500).json({ error: "No response from language model" });
                return;
            }

            const responseMessage = {
                ...userMessage,
                userId: runtime.agentId,
                content: response,
            };

            await runtime.messageManager.createMemory(responseMessage);
            await runtime.evaluate(memory, state);

            await runtime.processActions(
                memory,
                [responseMessage],
                state,
                async () => {
                    return [memory];
                }
            );

            const speechResponse = await runtime.useModel(ModelClass.TEXT_TO_SPEECH, response.text);
            const audioBuffer = await speechResponse.arrayBuffer();

            res.set({
                "Content-Type": "audio/mpeg",
                "Transfer-Encoding": "chunked",
            });

            res.send(Buffer.from(audioBuffer));
            logger.success(`[SPEECH] Successfully processed conversation and generated speech for: ${runtime.character.name}`);
        } catch (error) {
            logger.error("[SPEECH] Error processing conversation:", error);
            res.status(500).json({
                error: "Error processing conversation",
                details: error.message,
            });
        }
    }) as RequestHandler);

    // ===== Room Management =====

    // Get rooms for an agent
    router.get('/:agentId/rooms', (async (req: Request, res: Response) => {
        const agentId = validateUuid(req.params.agentId);
        if (!agentId) {
            logger.warn("[ROOMS] Invalid agent ID format");
            res.status(400).json({ error: "Invalid agent ID format" });
            return;
        }

        let runtime = agents.get(agentId);
        if (!runtime) {
            runtime = Array.from(agents.values()).find(
                (a) => a.character.name.toLowerCase() === agentId.toLowerCase()
            );
        }

        if (!runtime) {
            logger.warn(`[ROOMS] Agent not found: ${agentId}`);
            res.status(404).json({ error: "Agent not found" });
            return;
        }

        try {
            const worldId = req.query.worldId as string;
            const rooms = await runtime.databaseAdapter.getRoomsForParticipant(agentId, runtime.agentId);

            const roomDetails = await Promise.all(
                rooms.map(async (roomId) => {
                    try {
                        const roomData = await runtime.databaseAdapter.getRoom(roomId, runtime.agentId);
                        if (!roomData) return null;

                        if (worldId && roomData.worldId !== worldId) {
                            return null;
                        }

                        const response: RoomResponse = {
                            id: roomId,
                            name: roomData.name || new Date().toLocaleString(),
                            source: roomData.source,
                            worldId: roomData.worldId
                        };
                        return response;
                    } catch (error) {
                        logger.error(`[ROOMS] Error getting details for room ${roomId}:`, error);
                        return null;
                    }
                })
            );

            const validRooms = roomDetails.filter(room => room !== null);
            logger.debug(`[ROOMS] Retrieved ${validRooms.length} rooms for agent: ${agentId}`);
            res.status(200).json(validRooms);
        } catch (error) {
            logger.error(`[ROOMS] Error retrieving rooms for agent ${agentId}:`, error);
            res.status(500).json({
                error: "Failed to retrieve rooms",
                details: error.message
            });
        }
    }) as RequestHandler);

    // Create a new room
    router.post('/:agentId/rooms', (async (req: Request, res: Response) => {
        const agentId = validateUuid(req.params.agentId);
        if (!agentId) {
            logger.warn("[ROOMS] Invalid agent ID format");
            res.status(400).json({ error: "Invalid agent ID format" });
            return;
        }

        let runtime = agents.get(agentId);
        if (!runtime) {
            runtime = Array.from(agents.values()).find(
                (a) => a.character.name.toLowerCase() === agentId.toLowerCase()
            );
        }

        if (!runtime) {
            logger.warn(`[ROOMS] Agent not found: ${agentId}`);
            res.status(404).json({ error: "Agent not found" });
            return;
        }

        try {
            const { name, worldId, roomId, userId } = req.body;
            const roomName = name || `Chat ${new Date().toLocaleString()}`;

            await runtime.ensureRoomExists({
                id: roomId,
                name: roomName,
                source: "client",
                type: ChannelType.API,
                worldId,
            });

            await runtime.ensureParticipantInRoom(runtime.agentId, roomId);
            await runtime.ensureParticipantInRoom(userId, roomId);

            const response: RoomResponse = {
                id: roomId,
                name: roomName,
                createdAt: Date.now(),
                source: "client",
                worldId
            };

            logger.debug(`[ROOMS] Created room ${roomId} for agent: ${agentId} in world: ${worldId}`);
            res.status(201).json(response);
        } catch (error) {
            logger.error(`[ROOMS] Error creating room for agent ${agentId}:`, error);
            res.status(500).json({
                error: "Failed to create room",
                details: error.message
            });
        }
    }) as RequestHandler);

    // ===== Audio Processing =====

    // Transcribe audio
    router.post('/:agentId/transcriptions', upload.single('file'), (async (req: CustomRequest, res: Response) => {
        const agentId = validateUuid(req.params.agentId);
        if (!agentId) {
            logger.warn("[TRANSCRIPTION] Invalid agent ID format");
            res.status(400).json({ error: "Invalid agent ID format" });
            return;
        }

        const audioFile = req.file;
        if (!audioFile) {
            logger.warn("[TRANSCRIPTION] No audio file provided");
            res.status(400).json({ error: "Audio file is required" });
            return;
        }

        let runtime = agents.get(agentId);
        if (!runtime) {
            runtime = Array.from(agents.values()).find(
                (a) => a.character.name.toLowerCase() === agentId.toLowerCase()
            );
        }

        if (!runtime) {
            logger.warn(`[TRANSCRIPTION] Agent not found: ${agentId}`);
            res.status(404).json({ error: "Agent not found" });
            return;
        }

        try {
            const audioBuffer = fs.readFileSync(audioFile.path);
            const transcription = await runtime.useModel(ModelClass.TRANSCRIPTION, audioBuffer);
            res.status(200).json({ text: transcription });
            logger.success(`[TRANSCRIPTION] Successfully transcribed audio for: ${runtime.character.name}`);
        } catch (error) {
            logger.error("[TRANSCRIPTION] Error processing audio:", error);
            res.status(500).json({
                error: "Error processing audio file",
                details: error.message
            });
        }
    }) as RequestHandler);

    return router;
}

