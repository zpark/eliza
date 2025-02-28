import type { Character, Content, IAgentRuntime, Media, Memory } from '@elizaos/core';
import { ChannelType, composeContext, createUniqueUuid, generateMessageResponse, logger, messageHandlerTemplate, ModelClass, validateCharacterConfig } from '@elizaos/core';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import type { AgentServer } from '..';
import { upload } from '../loader';
import { validateUUIDParams } from './api-utils';

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
        const agentsList = Array.from(agents.values()).map((agent) => ({
            id: agent.agentId,
            name: agent.character.name,
            clients: Array.from(agent.getAllClients().keys())
        }));
        res.json({ agents: agentsList });
    });

    router.get('/:agentId', (req, res) => {
        const { agentId } = validateUUIDParams(req.params, res) ?? {
            agentId: null,
        };
        if (!agentId) return;

        const agent = agents.get(agentId);

        if (!agent) {
            res.status(404).json({ error: 'Agent not found' });
            return;
        }

        const character = agent?.character;
        if (character?.settings?.secrets) {
            character.settings.secrets = undefined;
        }
        if (character?.secrets) {
            character.secrets = undefined;
        }

        res.json({
            id: agent.agentId,
            character: agent.character,
        });
    });

    router.delete('/:agentId', async (req, res) => {
        const { agentId } = validateUUIDParams(req.params, res) ?? {
            agentId: null,
        };
        if (!agentId) return;

        const agent: IAgentRuntime = agents.get(agentId);

        if (agent) {
            agent.stop();
            directClient.unregisterAgent(agent);
            res.status(204).json({ success: true });
        } else {
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

        const roomId = createUniqueUuid(this.runtime, req.body.roomId ?? `default-room-${agentId}`);
        const userId = createUniqueUuid(this.runtime, req.body.userId ?? "user");

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
            });

            logger.info(`[MESSAGE ENDPOINT] req.body: ${JSON.stringify(req.body)}`);

            const messageId = createUniqueUuid(this.runtime, Date.now().toString());

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
                id: createUniqueUuid(this.runtime, messageId),
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

            logger.info(`[MESSAGE ENDPOINT] After generateMessageResponse, response: ${response}`);

            if (!response) {
                res.status(500).json({
                    error: "No response from generateMessageResponse"
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
        if (!agentId) return;

        let agent: IAgentRuntime = agents.get(agentId);

        if (agent) {
            agent.stop();
            directClient.unregisterAgent(agent);
        }

        const character = req.body;
        try {
            validateCharacterConfig(character);
        } catch (e) {
            logger.error(`Error parsing character: ${e}`);
            res.status(400).json({
                success: false,
                message: e.message,
            });
            return;
        }

        try {
            agent = await directClient.startAgent(character);
            await agent.ensureCharacterExists(character);
            logger.log(`${character.name} started`);
        } catch (e) {
            logger.error(`Error starting agent: ${e}`);
            res.status(500).json({
                success: false,
                message: e.message,
            });
            return;
        }

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
        if (!agentId || !roomId) return;

        let runtime = agents.get(agentId);

        if (!runtime) {
            runtime = Array.from(agents.values()).find(
                (a) => a.character.name.toLowerCase() === agentId.toLowerCase()
            );
        }

        if (!runtime) {
            res.status(404).send('Agent not found');
            return;
        }

        try {
            const memories = await runtime.messageManager.getMemories({
                roomId,
            });
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
        } catch (error) {
            console.error('Error fetching memories:', error);
            res.status(500).json({ error: 'Failed to fetch memories' });
        }
    });

    router.post('/start', async (req, res) => {
        const { characterPath, characterJson } = req.body;
        try {
            let character: Character;
            if (characterJson) {
                character = await directClient.jsonToCharacter(characterJson);
            } else if (characterPath) {
                character = await directClient.loadCharacterTryPath(characterPath);
            } else {
                throw new Error('No character path or JSON provided');
            }
            await directClient.startAgent(character);
            logger.log(`${character.name} started`);

            res.json({
                id: character.id,
                character: character,
            });
        } catch (e) {
            logger.error(`Error parsing character: ${e}`);
            res.status(400).json({
                error: e.message,
            });
            return;
        }
    });

    router.post('/start/:characterName', async (req, res) => {
        const characterName = req.params.characterName;
        try {
            let character: Character;

            const anyAgent = Array.from(agents.values())[0];
            if (anyAgent?.databaseAdapter) {
                character = await anyAgent.databaseAdapter.getCharacter(characterName);
            }

            if (!character) {
                try {
                    character = await directClient.loadCharacterTryPath(characterName);
                } catch (_e) {
                    const existingAgent = Array.from(agents.values()).find(
                        (a) => a.character.name.toLowerCase() === characterName.toLowerCase()
                    );

                    if (!existingAgent) {
                        res.status(404).json({
                            error: `Character '${characterName}' not found in database, filesystem, or running agents`
                        });
                        return;
                    }

                    character = existingAgent.character;
                }
            }

            await directClient.startAgent(character);
            logger.log(`${character.name} started`);

            res.json({
                id: character.id,
                character: character,
            });
        } catch (e) {
            logger.error(`Error starting character by name: ${e}`);
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
            agent.stop();
            directClient.unregisterAgent(agent);
            res.json({ success: true });
        } else {
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
        if (!agentId) return;

        const { text, roomId: rawRoomId, userId: rawUserId } = req.body;
        const roomId = createUniqueUuid(this.runtime, rawRoomId ?? `default-room-${agentId}`);
        const userId = createUniqueUuid(this.runtime, rawUserId ?? "user");

        if (!text) {
            res.status(400).send("No text provided");
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

        try {
            // Process message through agent
            await runtime.ensureConnection({
                userId,
                roomId,
                userName: req.body.userName,
                userScreenName: req.body.name,
                source: "direct",
                type: ChannelType.API,
            });

            const messageId = createUniqueUuid(this.runtime, Date.now().toString());

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

            // save response to memory
            const responseMessage = {
                ...userMessage,
                userId: runtime.agentId,
                content: response,
            };

            await runtime.messageManager.createMemory(responseMessage);

            if (!response) {
                res.status(500).send(
                    "No response from generateMessageResponse"
                );
                return;
            }

            await runtime.evaluate(memory, state);

            const _result = await runtime.processActions(
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
        } catch (error) {
            logger.error("Error processing message or generating speech:", error);
            res.status(500).json({
                error: "Error processing message or generating speech",
                details: error.message,
            });
        }
    });

    router.post('/:agentId/tts', async (req, res) => {
        const { agentId } = validateUUIDParams(req.params, res) ?? { agentId: null };
        if (!agentId) return;

        const { text } = req.body;
        if (!text) {
            res.status(400).send("No text provided");
            return;
        }

        const runtime = agents.get(agentId);
        if (!runtime) {
            res.status(404).send("Agent not found");
            return;
        }

        try {
            const speechResponse = await runtime.useModel(ModelClass.TEXT_TO_SPEECH, text);
            const audioBuffer = await speechResponse.arrayBuffer();

            res.set({
                "Content-Type": "audio/mpeg",
                "Transfer-Encoding": "chunked",
            });

            res.send(Buffer.from(audioBuffer));
        } catch (error) {
            logger.error("Error generating speech:", error);
            res.status(500).json({
                error: "Error generating speech",
                details: error.message,
            });
        }
    });

    return router;
} 

