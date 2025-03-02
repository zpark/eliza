import type { Character, Content, IAgentRuntime, Media, Memory } from '@elizaos/core';
import { ChannelType, composeContext, createUniqueUuid, logger, messageHandlerTemplate, ModelClass, parseJSONObjectFromText, stringToUuid, validateCharacterConfig, validateUuid } from '@elizaos/core';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import type { AgentServer } from '..';
import { upload } from '../loader';


interface CustomRequest extends express.Request {
    file?: Express.Multer.File;
    params: {
        agentId: string;
    };
}

export function agentRouter(
    agents: Map<string, IAgentRuntime>,
    server?: AgentServer
): express.Router {
    const router = express.Router();

    router.get('/', async (req, res) => {
        logger.debug("[AGENTS LIST] Retrieving list of all agents");
        const agents = await server?.database.getAgents();
        res.json({ agents });
    });
    
    router.get('/:agentId', async (req, res) => {
        if (!req.params.agentId) {
            logger.warn("[AGENT GET] Invalid agent ID format");
            return;
        }

        const agentId = validateUuid(req.params.agentId);
        if (!agentId) {
            logger.warn("[AGENT GET] Invalid agent ID format");
            return;
        }

        logger.info(`[AGENT GET] Retrieving information for agent: ${agentId}`);
        const agent = await server?.database.getAgent(agentId);

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
            id: agentId,
            enabled: agent.enabled,
            character: agent.character,
        });
        
        logger.debug(`[AGENT GET] Successfully returned agent data for: ${agent.character.name}`);
    });

    router.delete('/:agentId', async (req, res) => {
        
        if (!req.params.agentId) {
            logger.warn("[AGENT DELETE] Invalid agent ID format");
            return;
        }

        const agentId = validateUuid(req.params.agentId);

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
                
                server?.unregisterAgent(agent);
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

        if (!req.params.agentId) {
            logger.warn("[MESSAGE ENDPOINT] Invalid agent ID format");
            return;
        }

        const agentId = validateUuid(req.params.agentId);
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

        const roomId = createUniqueUuid(runtime, req.body.roomId ?? `default-room-${agentId}`);
        const userId = createUniqueUuid(runtime, req.body.userId ?? "user");
        const worldId = req.body.worldId; // Extract worldId from request body

        logger.info(`[MESSAGE ENDPOINT] Runtime found: ${runtime?.character?.name}`);

        // try {
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

            const messageId = createUniqueUuid(runtime, Date.now().toString());

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
                id: createUniqueUuid(runtime, messageId),
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

            logger.info("[MESSAGE ENDPOINT] Before useModel");

            const responseText = await runtime.useModel(ModelClass.TEXT_LARGE, {
                context,
              });
          
            const response = parseJSONObjectFromText(responseText) as Content;
              

            logger.info(`[MESSAGE ENDPOINT] After useModel, response: ${JSON.stringify(response)}`);

            if (!response) {
                res.status(500).json({
                    error: "No response from useModel"
                });
                return;
            }

            // save response to memory
            const responseMessage: Memory = {
                id: createUniqueUuid(runtime, messageId),
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
        // } catch (error) {
        //     logger.error("Error processing message:", error);
        //     console.trace(error);
        //     res.status(500).json({
        //         error: "Error processing message",
        //         details: error.message
        //     });
        // }
    });

    router.post('/:agentId/set', async (req, res) => {

        const agentId = validateUuid(req.params.agentId);

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
                
                server?.unregisterAgent(agent);
                logger.success(`[AGENT UPDATE] Successfully unregistered existing agent: ${existingName}`);
            } catch (error) {
                logger.error("[AGENT UPDATE] Error stopping existing agent:", error);
            }
        } else {
            logger.info(`[AGENT UPDATE] No existing agent found with ID: ${agentId}, will create new one`);
        }

        const character = req.body;
        logger.debug("[AGENT UPDATE] Validating character configuration");
        try {
            validateCharacterConfig(character);
            logger.debug(`[AGENT UPDATE] Character configuration valid for: ${character.name}`);
        } catch (e) {
            logger.error("[AGENT UPDATE] Error validating character configuration:", e);
            res.status(400).json({
                success: false,
                message: e.message,
            });
            return;
        }

        try {
            logger.info(`[AGENT UPDATE] Starting updated agent: ${character.name}`);
            agent = await server?.startAgent(character);
            await agent.ensureCharacterExists(character);
            logger.success(`[AGENT UPDATE] Agent successfully updated and started: ${character.name} (${character.id})`);
        } catch (e) {
            logger.error("[AGENT UPDATE] Error starting updated agent:", e);
            res.status(500).json({
                success: false,
                message: e.message,
            });
            return;
        }

        logger.debug(`[AGENT UPDATE] Returning updated agent data for: ${character.name}`);
        res.json({
            id: character.id,
            character: character,
        });
    });


    router.post('/start', async (req, res) => {
        logger.info("[AGENT START] Received request to start a new agent");
        const { characterPath, characterJson, agentId } = req.body;
        
        // Log request details
        if (agentId) {
            logger.debug(`[AGENT START] Using agent ID: ${agentId}`);
        } else if (characterPath) {
            logger.debug(`[AGENT START] Using character path: ${characterPath}`);
        } else if (characterJson) {
            logger.debug("[AGENT START] Using provided character JSON");
        } else {
            logger.warn("[AGENT START] No agent ID, character path, or JSON provided");
        }
        
        try {
            let character: Character;
            let source = "";

            // Try to find agent by ID first if provided
            if (agentId) {
                logger.debug(`[AGENT START] Looking for agent in database: ${agentId}`);
                const validAgentId = validateUuid(agentId);
                
                if (!validAgentId) {
                    const errorMessage = "Invalid agent ID format";
                    logger.error(`[AGENT START] ${errorMessage}`);
                    throw new Error(errorMessage);
                }
                
                if (server?.database) {
                    const agent = await server.database.getAgent(validAgentId);
                    if (agent) {
                        character = agent.character;
                        source = "database";
                        logger.debug(`[AGENT START] Found agent in database: ${agent.character.name} (${validAgentId})`);
                    } else {
                        logger.warn(`[AGENT START] Agent not found in database by ID: ${validAgentId}`);
                    }
                }
            }
            
            // If agent ID wasn't provided or agent wasn't found, fallback to other methods
            if (!character) {
                if (characterJson) {
                    logger.debug("[AGENT START] Parsing character from JSON");
                    character = await server?.jsonToCharacter(characterJson);
                    source = "json";
                } else if (characterPath) {
                    logger.debug(`[AGENT START] Loading character from path: ${characterPath}`);
                    character = await server?.loadCharacterTryPath(characterPath);
                    source = "path";
                } else if (!agentId) { // Only throw if agentId wasn't provided
                    const errorMessage = "No character path or JSON provided";
                    logger.error(`[AGENT START] ${errorMessage}`);
                    throw new Error(errorMessage);
                } else {
                    const errorMessage = `Agent with ID ${agentId} not found`;
                    logger.error(`[AGENT START] ${errorMessage}`);
                    throw new Error(errorMessage);
                }
            }
            
            // Check if character was found
            if (!character) {
                const errorMessage = "No valid agent or character information provided";
                logger.error(`[AGENT START] ${errorMessage}`);
                throw new Error(errorMessage);
            }
            
            logger.info(`[AGENT START] Starting agent for character: ${character.name} (source: ${source})`);
            const agent = await server?.startAgent(character);
            logger.success(`[AGENT START] Agent started successfully: ${character.name} (${character.id})`);

            res.json({
                id: agent.agentId,
                character: agent.character,
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
            
            if (server?.database) {
                character = await server?.database.getCharacter(characterName);
                if (character) {
                    source = "database";
                    logger.debug(`[AGENT START BY NAME] Found character in database: ${characterName}`);
                }
            }

            if (!character) {
                try {
                    logger.debug(`[AGENT START BY NAME] Trying to load character from filesystem: ${characterName}`);
                    character = await server?.loadCharacterTryPath(characterName);
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
            await server?.startAgent(character);
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

    // Add dedicated endpoint for starting an agent by ID
    router.post('/:agentId/start', async (req, res) => {
        if (!req.params.agentId) {
            logger.warn("[AGENT START] Invalid agent ID format");
            res.status(400).json({ error: "Missing agent ID" });
            return;
        }

        const agentId = validateUuid(req.params.agentId);
        if (!agentId) {
            logger.warn("[AGENT START] Invalid agent ID format");
            res.status(400).json({ error: "Invalid agent ID format" });
            return;
        }

        logger.info(`[AGENT START] Request to start agent with ID: ${agentId}`);
        
        try {
            let character: Character;
            
            if (server?.database) {
                logger.debug(`[AGENT START] Looking for agent in database: ${agentId}`);
                const agent = await server.database.getAgent(agentId);
                if (agent) {
                    character = agent.character;
                    logger.debug(`[AGENT START] Found agent in database: ${agent.character.name} (${agentId})`);
                } else {
                    const errorMsg = `Agent with ID '${agentId}' not found in database`;
                    logger.warn(`[AGENT START] ${errorMsg}`);
                    res.status(404).json({ error: errorMsg });
                    return;
                }
            } else {
                const errorMsg = "Database not available";
                logger.error(`[AGENT START] ${errorMsg}`);
                res.status(500).json({ error: errorMsg });
                return;
            }

            logger.info(`[AGENT START] Starting agent for character: ${character.name}`);
            const agent = await server?.startAgent(character);
            logger.success(`[AGENT START] Agent started successfully: ${character.name} (${character.id})`);

            res.json({
                id: agent.agentId,
                character: agent.character,
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

    router.post('/:agentId/stop', async (req, res) => {
        const agentId = req.params.agentId;
        const agent: IAgentRuntime = agents.get(agentId);

        if (agent) {
            // Store the agent name before stopping
            const agentName = agent.character.name;
            
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
                server?.unregisterAgent(agent);
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
        

        const agentId = validateUuid(req.params.agentId);
        if (!agentId) {
            logger.warn("[SPEAK] Invalid agent ID format");
            return;
        }

        logger.info(`[SPEAK] Request to process speech for agent: ${agentId}`);
        const { text, roomId: rawRoomId, userId: rawUserId } = req.body;
        const roomId = createUniqueUuid(this.runtime, rawRoomId ?? `default-room-${agentId}`);
        const userId = createUniqueUuid(this.runtime, rawUserId ?? "user");

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

            logger.debug("[SPEAK] Creating memory for user message");
            await runtime.messageManager.createMemory(memory);

            logger.debug("[SPEAK] Composing state for message processing");
            const state = await runtime.composeState(userMessage, {
                agentName: runtime.character.name,
            });

            logger.debug("[SPEAK] Creating context for LLM processing");
            const context = composeContext({
                state,
                template: messageHandlerTemplate,
            });

            logger.info("[SPEAK] Using LLM to generate response");
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
                logger.error("[SPEAK] No response received from LLM");
                res.status(500).send(
                    "No response from useModel"
                );
                return;
            }

            logger.debug("[SPEAK] Creating memory for agent response");
            // save response to memory
            const responseMessage = {
                ...userMessage,
                userId: runtime.agentId,
                content: response,
            };

            await runtime.messageManager.createMemory(responseMessage);

            logger.debug("[SPEAK] Evaluating and processing actions");
            await runtime.evaluate(memory, state);

            const _result = await runtime.processActions(
                memory,
                [responseMessage],
                state,
                async () => {
                    return [memory];
                }
            );

            logger.info("[SPEAK] Generating speech from text response");
            const speechResponse = await runtime.useModel(ModelClass.TEXT_TO_SPEECH, response.text);
            const audioBuffer = await speechResponse.arrayBuffer();

            logger.debug("[SPEAK] Setting response headers and sending audio data");
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
        const agentId = validateUuid(req.params.agentId);
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
            logger.info("[TTS] Using text-to-speech model to generate audio");
            const speechResponse = await runtime.useModel(ModelClass.TEXT_TO_SPEECH, text);
            const audioBuffer = await speechResponse.arrayBuffer();

            logger.debug("[TTS] Setting response headers and sending audio data");
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
        if (!req.params.agentId) {
            logger.warn("[ROOMS GET] Invalid agent ID format");
            return;
        }

        const agentId = validateUuid(req.params.agentId);
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
            const rooms = await runtime.databaseAdapter.getRoomsForParticipant(agentId);
            
            // Get details for each room
            const roomDetails = await Promise.all(
                rooms.map(async (roomId) => {
                    try {
                        const roomData = await runtime.databaseAdapter.getRoom(roomId);
                        if (!roomData) return null;
                        
                        // Filter by worldId if provided
                        if (worldId && roomData.worldId !== worldId) {
                            return null;
                        }
                        
                        return {
                            id: roomId,
                            name: roomData.name || new Date().toLocaleString(),
                            source: roomData.source,
                            worldId: roomData.worldId
                        };
                    } catch (error) {
                        logger.error(`[ROOMS GET] Error getting details for room ${roomId}:`, error);
                        return null;
                    }
                })
            );
            
            // Filter out any null results
            const validRooms = roomDetails.filter(room => room !== null);
            
            logger.debug(`[ROOMS GET] Retrieved ${validRooms.length} rooms for agent: ${agentId}`);
            res.json(validRooms);
        } catch (error) {
            logger.error(`[ROOMS GET] Error retrieving rooms for agent ${agentId}:`, error);
            res.status(500).json({ message: "Failed to retrieve rooms" });
        }
    });

    // Create a new room for an agent
    router.post('/:agentId/rooms', async (req, res) => {

        const agentId = validateUuid(req.params.agentId);
        
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
            const { name, worldId, roomId, userId } = req.body;
            const roomName = name || `Chat ${new Date().toLocaleString()}`;
            
            // Create the room
            await runtime.ensureRoomExists({
                id: roomId,
                name: roomName,
                source: "client",
                type: ChannelType.API, // Direct message
                worldId, // Include the worldId from the request
            });
            
            // Add the agent to the room
            await runtime.ensureParticipantInRoom(runtime.agentId, roomName);
            
            // Add the default user to the room
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

