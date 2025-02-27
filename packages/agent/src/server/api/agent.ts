import express from 'express';
import type { Character, IAgentRuntime, Media } from '@elizaos/core';
import { ChannelType, composeContext, generateMessageResponse, logger, ModelClass, stringToUuid, validateCharacterConfig } from '@elizaos/core';
import fs from 'node:fs';
import type { AgentServer } from '..';
import { validateUUIDParams } from './api-utils';

import type { Content, Memory } from '@elizaos/core';
import path from 'node:path';
import { messageHandlerTemplate } from '../helper';
import { upload } from '../loader';

interface CustomRequest extends express.Request {
    file?: Express.Multer.File;
    params: {
        agentId: string;
    };
}

export function agentRouter(
    agents: Map<string, IAgentRuntime>,
    directClient: AgentServer
): express.Router {
    const router = express.Router();

    router.get('/', (_req, res) => {
        logger.debug("[AGENTS LIST] Retrieving list of all agents");
        
        const agentsList = Array.from(agents.values()).map((agent) => ({
            id: agent.agentId,
            name: agent.character.name,
            clients: Array.from(agent.getAllClients().keys())
        }));
        
        logger.debug(`[AGENTS LIST] Found ${agentsList.length} active agents`);
        res.json({ agents: agentsList });
    });

    router.get('/:agentId', (req, res) => {
        const { agentId } = validateUUIDParams(req.params, res) ?? {
            agentId: null,
        };
        if (!agentId) {
            logger.warn("[AGENT GET] Invalid agent ID format");
            return;
        }

        logger.info(`[AGENT GET] Retrieving information for agent: ${agentId}`);
        const agent = agents.get(agentId);

        if (!agent) {
            logger.warn(`[AGENT GET] Agent not found: ${agentId}`);
            res.status(404).json({ error: 'Agent not found' });
            return;
        }

        logger.debug(`[AGENT GET] Found agent: ${agent.character.name} (${agentId})`);
        
        // Sanitize sensitive data
        const character = agent?.character;
        if (character?.settings?.secrets) {
            character.settings.secrets = undefined;
            logger.debug("[AGENT GET] Sanitized secrets from agent settings");
        }
        if (character?.secrets) {
            character.secrets = undefined;
            logger.debug("[AGENT GET] Sanitized top-level secrets from agent");
        }

        res.json({
            id: agent.agentId,
            character: agent.character,
        });
        
        logger.debug(`[AGENT GET] Successfully returned agent data for: ${agent.character.name}`);
    });

    router.delete('/:agentId', async (req, res) => {
        const { agentId } = validateUUIDParams(req.params, res) ?? {
            agentId: null,
        };
        if (!agentId) {
            logger.warn("[AGENT DELETE] Invalid agent ID format");
            return;
        }

        logger.info(`[AGENT DELETE] Request to delete agent: ${agentId}`);
        const agent: IAgentRuntime = agents.get(agentId);

        if (agent) {
            const agentName = agent.character.name;
            logger.info(`[AGENT DELETE] Stopping agent: ${agentName} (${agentId})`);
            
            try {
                agent.stop();
                logger.success(`[AGENT DELETE] Agent stopped: ${agentName}`);
                
                directClient.unregisterAgent(agent);
                logger.success(`[AGENT DELETE] Agent unregistered: ${agentName}`);
                
                res.status(204).json({ success: true });
                logger.info(`[AGENT DELETE] Successfully deleted agent: ${agentName} (${agentId})`);
            } catch (error) {
                logger.error(`[AGENT DELETE] Error deleting agent: ${agentName}`, error);
                res.status(500).json({ error: 'Error deleting agent', details: error.message });
            }
        } else {
            logger.warn(`[AGENT DELETE] Agent not found: ${agentId}`);
            res.status(404).json({ error: 'Agent not found' });
        }
    });

    router.post('/:agentId/message', async (req: CustomRequest, res) => {
        logger.info("[MESSAGE ENDPOINT] **ROUTE HIT** - Entering /message endpoint");

        const { agentId } = validateUUIDParams(req?.params, res) ?? {
            agentId: null,
        };
        if (!agentId) return;

        // Add logging to debug the request body
        logger.info(`[MESSAGE ENDPOINT] Raw body: ${JSON.stringify(req.body)}`);
        
        const text = req.body?.text?.trim();
        logger.info(`[MESSAGE ENDPOINT] Parsed text: ${text}`);

        // Move the text validation check here, before other processing
        if (!text) {
            res.status(400).json({ error: "Text message is required" });
            return;
        }

        const roomId = stringToUuid(req.body.roomId ?? `default-room-${agentId}`);
        const userId = stringToUuid(req.body.userId ?? "user");
        const worldId = req.body.worldId; // Extract worldId from request body

        let runtime = agents.get(agentId);

        // if runtime is null, look for runtime with the same name
        if (!runtime) {
            runtime = Array.from(agents.values()).find(
                (a) =>
                    a.character.name.toLowerCase() ===
                    agentId.toLowerCase()
            );
        }

        if (!runtime) {
            res.status(404).json({ error: 'Agent not found' });
            return;
        }

        logger.info(`[MESSAGE ENDPOINT] Runtime found: ${runtime?.character?.name}`);

        try {
            await runtime.ensureConnection({
                userId,
                roomId,
                userName: req.body.userName,
                userScreenName: req.body.name,
                source: "direct",
                type: ChannelType.API,
                worldId, // Include worldId in the connection
            });

            logger.info(`[MESSAGE ENDPOINT] req.body: ${JSON.stringify(req.body)}`);

            const messageId = stringToUuid(Date.now().toString());

            const attachments: Media[] = [];
            if (req.file) {
                const filePath = path.join(
                    process.cwd(),
                    "data",
                    "uploads",
                    req.file.filename
                );
                attachments.push({
                    id: Date.now().toString(),
                    url: filePath,
                    title: req.file.originalname,
                    source: "direct",
                    description: `Uploaded file: ${req.file.originalname}`,
                    text: "",
                    contentType: req.file.mimetype,
                });
            }

            const content: Content = {
                text,
                attachments,
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
                id: stringToUuid(`${messageId}-${userId}`),
                ...userMessage,
                agentId: runtime.agentId,
                userId,
                roomId,
                content,
                createdAt: Date.now(),
            };

            await runtime.messageManager.addEmbeddingToMemory(memory);
            await runtime.messageManager.createMemory(memory);

            let state = await runtime.composeState(userMessage, {
                agentName: runtime.character.name,
            });

            const context = composeContext({
                state,
                template: messageHandlerTemplate,
            });

            logger.info("[MESSAGE ENDPOINT] Before generateMessageResponse");

            const response = await generateMessageResponse({
                runtime: runtime,
                context,
                modelClass: ModelClass.TEXT_LARGE,
            });

            logger.info(`[MESSAGE ENDPOINT] After generateMessageResponse, response: ${JSON.stringify(response)}`);

            if (!response) {
                res.status(500).json({
                    error: "No response from generateMessageResponse"
                });
                return;
            }

            // save response to memory
            const responseMessage: Memory = {
                id: stringToUuid(`${messageId}-${runtime.agentId}`),
                ...userMessage,
                userId: runtime.agentId,
                content: response,
                createdAt: Date.now(),
            };

            await runtime.messageManager.createMemory(responseMessage);

            state = await runtime.updateRecentMessageState(state);

            const replyHandler = async (message: Content) => {
                res.json([message]);
                return [memory];
            }

            await runtime.processActions(
                memory,
                [responseMessage],
                state,
                replyHandler
            );

            await runtime.evaluate(memory, state);
        } catch (error) {
            logger.error("Error processing message:", error);
            res.status(500).json({
                error: "Error processing message",
                details: error.message
            });
        }
    });

    router.post('/:agentId/set', async (req, res) => {
        const { agentId } = validateUUIDParams(req.params, res) ?? {
            agentId: null,
        };
        if (!agentId) {
            logger.warn("[AGENT UPDATE] Invalid agent ID format");
            return;
        }

        logger.info(`[AGENT UPDATE] Request to update agent: ${agentId}`);
        let agent: IAgentRuntime = agents.get(agentId);

        // Stop and unregister existing agent if found
        if (agent) {
            const existingName = agent.character.name;
            logger.info(`[AGENT UPDATE] Stopping existing agent: ${existingName} (${agentId})`);
            
            try {
                agent.stop();
                logger.success(`[AGENT UPDATE] Successfully stopped existing agent: ${existingName}`);
                
                directClient.unregisterAgent(agent);
                logger.success(`[AGENT UPDATE] Successfully unregistered existing agent: ${existingName}`);
            } catch (error) {
                logger.error(`[AGENT UPDATE] Error stopping existing agent:`, error);
            }
        } else {
            logger.info(`[AGENT UPDATE] No existing agent found with ID: ${agentId}, will create new one`);
        }

        const character = req.body;
        logger.debug(`[AGENT UPDATE] Validating character configuration`);
        try {
            validateCharacterConfig(character);
            logger.debug("[AGENT UPDATE] Character configuration valid for: " + character.name);
        } catch (e) {
            logger.error(`[AGENT UPDATE] Error validating character configuration:`, e);
            res.status(400).json({
                success: false,
                message: e.message,
            });
            return;
        }

        try {
            logger.info(`[AGENT UPDATE] Starting updated agent: ${character.name}`);
            agent = await directClient.startAgent(character);
            await agent.ensureCharacterExists(character);
            logger.success(`[AGENT UPDATE] Agent successfully updated and started: ${character.name} (${character.id})`);
        } catch (e) {
            logger.error(`[AGENT UPDATE] Error starting updated agent:`, e);
            res.status(500).json({
                success: false,
                message: e.message,
            });
            return;
        }

        logger.debug("[AGENT UPDATE] Returning updated agent data for: " + character.name);
        res.json({
            id: character.id,
            character: character,
        });
    });

    router.get('/:agentId/:roomId/memories', async (req, res) => {
        const { agentId, roomId } = validateUUIDParams(req.params, res) ?? {
            agentId: null,
            roomId: null,
        };
        if (!agentId || !roomId) {
            logger.warn("[MEMORIES GET] Invalid agent ID or room ID format");
            return;
        }

        logger.info(`[MEMORIES GET] Retrieving memories for agent: ${agentId}, room: ${roomId}`);
        let runtime = agents.get(agentId);

        if (!runtime) {
            logger.debug(`[MEMORIES GET] Agent not found by ID, trying to find by name: ${agentId}`);
            runtime = Array.from(agents.values()).find(
                (a) => a.character.name.toLowerCase() === agentId.toLowerCase()
            );
        }

        if (!runtime) {
            logger.warn(`[MEMORIES GET] Agent not found: ${agentId}`);
            res.status(404).send('Agent not found');
            return;
        }

        logger.debug(`[MEMORIES GET] Found agent: ${runtime.character.name}, fetching memories`);
        try {
            const { limit, before } = req.query;
            const limitValue = limit ? parseInt(limit as string, 10) : undefined;
            const beforeValue = before ? parseInt(before as string, 10) : undefined;
            
            const memories = await runtime.messageManager.getMemories({
                roomId,
                count: limitValue,
                end: beforeValue,
            });
            
            logger.debug(`[MEMORIES GET] Retrieved ${memories.length} memories for room: ${roomId}`);
            
            const response = {
                agentId,
                roomId,
                memories: memories.map((memory) => ({
                    id: memory.id,
                    userId: memory.userId,
                    agentId: memory.agentId,
                    createdAt: memory.createdAt,
                    content: {
                        text: memory.content.text,
                        action: memory.content.action,
                        source: memory.content.source,
                        url: memory.content.url,
                        inReplyTo: memory.content.inReplyTo,
                        attachments: memory.content.attachments?.map(
                            (attachment) => ({
                                id: attachment.id,
                                url: attachment.url,
                                title: attachment.title,
                                source: attachment.source,
                                description: attachment.description,
                                text: attachment.text,
                                contentType: attachment.contentType,
                            })
                        ),
                    },
                    embedding: memory.embedding,
                    roomId: memory.roomId,
                    unique: memory.unique,
                    similarity: memory.similarity,
                })),
            };

            res.json(response);
            logger.debug(`[MEMORIES GET] Successfully returned ${memories.length} memories`);
        } catch (error) {
            logger.error('[MEMORIES GET] Error fetching memories:', error);
            res.status(500).json({ error: 'Failed to fetch memories' });
        }
    });

    router.post('/start', async (req, res) => {
        logger.info("[AGENT START] Received request to start a new agent");
        const { characterPath, characterJson } = req.body;
        
        // Log request details
        if (characterPath) {
            logger.debug(`[AGENT START] Using character path: ${characterPath}`);
        } else if (characterJson) {
            logger.debug("[AGENT START] Using provided character JSON");
        } else {
            logger.warn("[AGENT START] No character path or JSON provided");
        }
        
        try {
            let character: Character;
            if (characterJson) {
                logger.debug("[AGENT START] Parsing character from JSON");
                character = await directClient.jsonToCharacter(characterJson);
            } else if (characterPath) {
                logger.debug(`[AGENT START] Loading character from path: ${characterPath}`);
                character = await directClient.loadCharacterTryPath(characterPath);
            } else {
                const errorMessage = "No character path or JSON provided";
                logger.error(`[AGENT START] ${errorMessage}`);
                throw new Error(errorMessage);
            }
            
            logger.info(`[AGENT START] Starting agent for character: ${character.name}`);
            const agent = await directClient.startAgent(character);
            logger.success(`[AGENT START] Agent started successfully: ${character.name} (${character.id})`);

            res.json({
                id: character.id,
                character: character,
            });
            logger.debug(`[AGENT START] Successfully returned agent data for: ${character.name}`);
        } catch (e) {
            logger.error(`[AGENT START] Error starting agent: ${e}`);
            res.status(400).json({
                error: e.message,
            });
            return;
        }
    });

    router.post('/start/:characterName', async (req, res) => {
        const characterName = req.params.characterName;
        logger.info(`[AGENT START BY NAME] Request to start agent with character name: ${characterName}`);
        
        try {
            let character: Character;
            let source = "";

            logger.debug(`[AGENT START BY NAME] Looking for character in database: ${characterName}`);
            const anyAgent = Array.from(agents.values())[0];
            if (anyAgent?.databaseAdapter) {
                character = await anyAgent.databaseAdapter.getCharacter(characterName);
                if (character) {
                    source = "database";
                    logger.debug(`[AGENT START BY NAME] Found character in database: ${characterName}`);
                }
            }

            if (!character) {
                try {
                    logger.debug(`[AGENT START BY NAME] Trying to load character from filesystem: ${characterName}`);
                    character = await directClient.loadCharacterTryPath(characterName);
                    source = "filesystem";
                    logger.debug(`[AGENT START BY NAME] Found character in filesystem: ${characterName}`);
                } catch (e) {
                    logger.debug(`[AGENT START BY NAME] Character not found in filesystem, checking running agents: ${characterName}`);
                    const existingAgent = Array.from(agents.values()).find(
                        (a) => a.character.name.toLowerCase() === characterName.toLowerCase()
                    );

                    if (!existingAgent) {
                        const errorMsg = `Character '${characterName}' not found in database, filesystem, or running agents`;
                        logger.warn(`[AGENT START BY NAME] ${errorMsg}`);
                        res.status(404).json({ error: errorMsg });
                        return;
                    }

                    character = existingAgent.character;
                    source = "running agent";
                    logger.debug(`[AGENT START BY NAME] Found character from running agent: ${characterName}`);
                }
            }

            logger.info(`[AGENT START BY NAME] Starting agent for character: ${character.name} (source: ${source})`);
            await directClient.startAgent(character);
            logger.success(`[AGENT START BY NAME] Agent started successfully: ${character.name} (${character.id})`);

            res.json({
                id: character.id,
                character: character,
            });
            logger.debug(`[AGENT START BY NAME] Successfully returned agent data for: ${character.name}`);
        } catch (e) {
            logger.error(`[AGENT START BY NAME] Error starting character by name: ${e}`);
            res.status(400).json({
                error: `Failed to start character '${characterName}': ${e.message}`,
            });
            return;
        }
    });

    router.post('/:agentId/stop', async (req, res) => {
        const agentId = req.params.agentId;
        const agent: IAgentRuntime = agents.get(agentId);

        if (agent) {
            // Store the agent name before stopping
            const agentName = agent.character.name;
            const agentInfo = {
                id: agentId,
                name: agentName
            };
            
            logger.info(`[AGENT SHUTDOWN] Starting shutdown process for agent ${agentName} (${agentId})`);
            logger.info(`[AGENT SHUTDOWN] Agent has ${agent.getAllClients().size} active clients to disconnect`);
            
            try {
                logger.info(`[AGENT SHUTDOWN] Stopping agent ${agentName} clients...`);
                await agent.stop();
                logger.success(`[AGENT SHUTDOWN] Agent ${agentName} clients successfully stopped`);
            } catch (error) {
                logger.error(`[AGENT SHUTDOWN] Error stopping agent ${agentName} clients:`, error);
            }
            
            try {
                logger.info(`[AGENT SHUTDOWN] Unregistering agent ${agentName} from server`);
                directClient.unregisterAgent(agent);
                logger.success(`[AGENT SHUTDOWN] Agent ${agentName} successfully unregistered from server`);
            } catch (error) {
                logger.error(`[AGENT SHUTDOWN] Error unregistering agent ${agentName}:`, error);
            }
            
            res.json({ 
                success: true,
                message: `Agent ${agentName} shutdown complete`,
                timestamp: Date.now()
            });
        } else {
            logger.warn(`[AGENT SHUTDOWN] Agent with ID ${agentId} not found`);
            res.status(404).json({ error: 'Agent not found' });
        }
    });

    router.post('/:agentId/whisper', upload.single('file'), async (req: CustomRequest, res: express.Response) => {
        const audioFile = req.file;
        const agentId = req.params.agentId;

        if (!audioFile) {
            res.status(400).send("No audio file provided");
            return;
        }

        let runtime = agents.get(agentId);

        if (!runtime) {
            runtime = Array.from(agents.values()).find(
                (a) => a.character.name.toLowerCase() === agentId.toLowerCase()
            );
        }

        if (!runtime) {
            res.status(404).send("Agent not found");
            return;
        }

        const audioBuffer = fs.readFileSync(audioFile.path);
        const transcription = await runtime.useModel(ModelClass.TRANSCRIPTION, audioBuffer);
        
        res.json({text: transcription});
    });

    router.post('/:agentId/speak', async (req, res) => {
        const { agentId } = validateUUIDParams(req.params, res) ?? { agentId: null };
        if (!agentId) {
            logger.warn("[SPEAK] Invalid agent ID format");
            return;
        }

        logger.info(`[SPEAK] Request to process speech for agent: ${agentId}`);
        const { text, roomId: rawRoomId, userId: rawUserId } = req.body;
        const roomId = stringToUuid(rawRoomId ?? `default-room-${agentId}`);
        const userId = stringToUuid(rawUserId ?? "user");

        if (!text) {
            logger.warn("[SPEAK] No text provided in request");
            res.status(400).send("No text provided");
            return;
        }

        logger.debug(`[SPEAK] Looking up agent: ${agentId} for text processing`);
        let runtime = agents.get(agentId);
        if (!runtime) {
            logger.debug(`[SPEAK] Agent not found by ID, trying to find by name: ${agentId}`);
            runtime = Array.from(agents.values()).find(
                (a) => a.character.name.toLowerCase() === agentId.toLowerCase()
            );
        }

        if (!runtime) {
            logger.warn(`[SPEAK] Agent not found: ${agentId}`);
            res.status(404).send("Agent not found");
            return;
        }

        logger.debug(`[SPEAK] Found agent: ${runtime.character.name}, processing speech request`);
        try {
            // Process message through agent
            logger.debug(`[SPEAK] Ensuring connection for user: ${userId} in room: ${roomId}`);
            await runtime.ensureConnection({
                userId,
                roomId,
                userName: req.body.userName,
                userScreenName: req.body.name,
                source: "direct",
                type: ChannelType.API,
            });

            const messageId = stringToUuid(Date.now().toString());
            logger.debug(`[SPEAK] Creating content object for message: ${messageId}`);

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

            logger.debug(`[SPEAK] Creating memory for user message`);
            await runtime.messageManager.createMemory(memory);

            logger.debug(`[SPEAK] Composing state for message processing`);
            const state = await runtime.composeState(userMessage, {
                agentName: runtime.character.name,
            });

            logger.debug(`[SPEAK] Creating context for LLM processing`);
            const context = composeContext({
                state,
                template: messageHandlerTemplate,
            });

            logger.info(`[SPEAK] Using LLM to generate response`);
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
                logger.error(`[SPEAK] No response received from LLM`);
                res.status(500).send(
                    "No response from generateMessageResponse"
                );
                return;
            }

            logger.debug(`[SPEAK] Creating memory for agent response`);
            // save response to memory
            const responseMessage = {
                ...userMessage,
                userId: runtime.agentId,
                content: response,
            };

            await runtime.messageManager.createMemory(responseMessage);

            logger.debug(`[SPEAK] Evaluating and processing actions`);
            await runtime.evaluate(memory, state);

            const _result = await runtime.processActions(
                memory,
                [responseMessage],
                state,
                async () => {
                    return [memory];
                }
            );

            logger.info(`[SPEAK] Generating speech from text response`);
            const speechResponse = await runtime.useModel(ModelClass.TEXT_TO_SPEECH, response.text);
            const audioBuffer = await speechResponse.arrayBuffer();

            logger.debug(`[SPEAK] Setting response headers and sending audio data`);
            res.set({
                "Content-Type": "audio/mpeg",
                "Transfer-Encoding": "chunked",
            });

            res.send(Buffer.from(audioBuffer));
            logger.success(`[SPEAK] Successfully processed and sent speech response for: ${runtime.character.name}`);
        } catch (error) {
            logger.error("[SPEAK] Error processing message or generating speech:", error);
            res.status(500).json({
                error: "Error processing message or generating speech",
                details: error.message,
            });
        }
    });

    router.post('/:agentId/tts', async (req, res) => {
        const { agentId } = validateUUIDParams(req.params, res) ?? { agentId: null };
        if (!agentId) {
            logger.warn("[TTS] Invalid agent ID format");
            return;
        }

        logger.info(`[TTS] Request to convert text to speech for agent: ${agentId}`);
        const { text } = req.body;
        if (!text) {
            logger.warn("[TTS] No text provided in request");
            res.status(400).send("No text provided");
            return;
        }

        logger.debug(`[TTS] Looking up agent: ${agentId}`);
        const runtime = agents.get(agentId);
        if (!runtime) {
            logger.warn(`[TTS] Agent not found: ${agentId}`);
            res.status(404).send("Agent not found");
            return;
        }

        logger.debug(`[TTS] Found agent: ${runtime.character.name}, generating speech`);
        try {
            logger.info(`[TTS] Using text-to-speech model to generate audio`);
            const speechResponse = await runtime.useModel(ModelClass.TEXT_TO_SPEECH, text);
            const audioBuffer = await speechResponse.arrayBuffer();

            logger.debug(`[TTS] Setting response headers and sending audio data`);
            res.set({
                "Content-Type": "audio/mpeg",
                "Transfer-Encoding": "chunked",
            });

            res.send(Buffer.from(audioBuffer));
            logger.success(`[TTS] Successfully generated and sent speech for: ${runtime.character.name}`);
        } catch (error) {
            logger.error("[TTS] Error generating speech:", error);
            res.status(500).json({
                error: "Error generating speech",
                details: error.message,
            });
        }
    });

    // Get rooms for an agent
    router.get('/:agentId/rooms', async (req, res) => {
        const { agentId } = validateUUIDParams(req.params, res) ?? { agentId: null };
        if (!agentId) {
            logger.warn("[ROOMS GET] Invalid agent ID format");
            return;
        }

        logger.info(`[ROOMS GET] Retrieving rooms for agent: ${agentId}`);
        let runtime = agents.get(agentId);

        if (!runtime) {
            logger.debug(`[ROOMS GET] Agent not found by ID, trying to find by name: ${agentId}`);
            runtime = Array.from(agents.values()).find(
                (a) => a.character.name.toLowerCase() === agentId.toLowerCase()
            );
        }

        if (!runtime) {
            logger.error(`[ROOMS GET] Agent not found: ${agentId}`);
            res.status(404).json({ message: `Agent not found: ${agentId}` });
            return;
        }

        try {
            // Extract worldId from query parameters or body
            const worldId = req.body.worldId || req.query.worldId as string;
            
            // Get rooms where this agent is a participant
            const rooms = await runtime.databaseAdapter.getRoomsForParticipant(agentId, runtime.agentId);
            
            // Get details for each room
            const roomDetails = await Promise.all(
                rooms.map(async (roomId) => {
                    try {
                        const roomData = await runtime.databaseAdapter.getRoom(roomId, runtime.agentId);
                        if (!roomData) return null;
                        
                        // Filter by worldId if provided
                        if (worldId && roomData.worldId !== worldId) {
                            return null;
                        }
                        
                        // Get the most recent message for this room
                        const recentMemories = await runtime.databaseAdapter.getMemoriesByRoomIds({
                            agentId: runtime.agentId,
                            roomIds: [roomId],
                            limit: 1
                        });
                        
                        const lastMessage = recentMemories.length > 0 ? recentMemories[0].text : null;
                        
                        return {
                            id: roomId,
                            name: roomData.name || `Chat ${new Date(roomData.createdAt || Date.now()).toLocaleString()}`,
                            createdAt: roomData.createdAt,
                            source: roomData.source,
                            worldId: roomData.worldId,
                            lastMessage
                        };
                    } catch (error) {
                        logger.error(`[ROOMS GET] Error getting details for room ${roomId}:`, error);
                        return null;
                    }
                })
            );
            
            // Filter out any null results and sort by most recent
            const validRooms = roomDetails
                .filter(room => room !== null)
                .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            
            logger.debug(`[ROOMS GET] Retrieved ${validRooms.length} rooms for agent: ${agentId}`);
            res.json(validRooms);
        } catch (error) {
            logger.error(`[ROOMS GET] Error retrieving rooms for agent ${agentId}:`, error);
            res.status(500).json({ message: "Failed to retrieve rooms" });
        }
    });

    // Create a new room for an agent
    router.post('/:agentId/rooms', async (req, res) => {
        const { agentId } = validateUUIDParams(req.params, res) ?? { agentId: null };
        if (!agentId) {
            logger.warn("[ROOM CREATE] Invalid agent ID format");
            return;
        }

        logger.info(`[ROOM CREATE] Creating room for agent: ${agentId}`);
        let runtime = agents.get(agentId);

        if (!runtime) {
            logger.debug(`[ROOM CREATE] Agent not found by ID, trying to find by name: ${agentId}`);
            runtime = Array.from(agents.values()).find(
                (a) => a.character.name.toLowerCase() === agentId.toLowerCase()
            );
        }

        if (!runtime) {
            logger.error(`[ROOM CREATE] Agent not found: ${agentId}`);
            res.status(404).json({ message: `Agent not found: ${agentId}` });
            return;
        }

        try {
            const { name, worldId } = req.body;
            const roomName = name || `Chat ${new Date().toLocaleString()}`;
            const roomId = crypto.randomUUID() as UUID;
            
            // Create the room
            await runtime.ensureRoomExists({
                id: roomId,
                name: roomName,
                source: "client",
                type: 0, // Direct message
                worldId, // Include the worldId from the request
            });
            
            // Add the agent to the room
            await runtime.ensureParticipantInRoom(runtime.agentId, roomId);
            
            // Add the default user to the room
            const userId = "00000000-0000-0000-0000-000000000000" as UUID;
            await runtime.ensureParticipantInRoom(userId, roomId);
            
            logger.debug(`[ROOM CREATE] Created room ${roomId} for agent: ${agentId} in world: ${worldId}`);
            res.json({
                id: roomId,
                name: roomName,
                createdAt: Date.now(),
                source: "client",
                worldId
            });
        } catch (error) {
            logger.error(`[ROOM CREATE] Error creating room for agent ${agentId}:`, error);
            res.status(500).json({ message: "Failed to create room" });
        }
    });

    return router;
} 

