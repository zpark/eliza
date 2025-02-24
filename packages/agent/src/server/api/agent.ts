import express from 'express';
import type { AgentServer } from '..';
import type { Character, IAgentRuntime } from '@elizaos/core';
import { logger, validateCharacterConfig } from '@elizaos/core';
import { validateUUIDParams } from './api-utils';

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
                } catch (e) {
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

    return router;
} 