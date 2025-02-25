import express from 'express';
import type { IAgentRuntime, ITeeLogService, TeeLogQuery } from '@elizaos/core';
import { logger, ServiceType } from '@elizaos/core';

export function teeRouter(
    agents: Map<string, IAgentRuntime>
): express.Router {
    const router = express.Router();

    router.get('/agents', async (_req, res) => {
        try {
            const allAgents = [];

            for (const agentRuntime of agents.values()) {
                const teeLogService = agentRuntime
                    .getService<ITeeLogService>(ServiceType.TEE)
                    .getInstance();

                const agents = await teeLogService.getAllAgents();
                allAgents.push(...agents);
            }

            const runtime: IAgentRuntime = agents.values().next().value;
            const teeLogService = runtime
                .getService<ITeeLogService>(ServiceType.TEE)
                .getInstance() as ITeeLogService;
            const attestation = await teeLogService.generateAttestation(
                JSON.stringify(allAgents)
            );
            res.json({ agents: allAgents, attestation: attestation });
        } catch (error) {
            logger.error('Failed to get TEE agents:', error);
            res.status(500).json({
                error: 'Failed to get TEE agents',
            });
        }
    });

    router.get('/agents/:agentId', async (req, res) => {
        try {
            const agentId = req.params.agentId;
            const agentRuntime = agents.get(agentId);
            if (!agentRuntime) {
                res.status(404).json({ error: 'Agent not found' });
                return;
            }

            const teeLogService = agentRuntime
                .getService<ITeeLogService>(ServiceType.TEE)
                .getInstance();

            const teeAgent = await teeLogService.getAgent(agentId);
            const attestation = await teeLogService.generateAttestation(
                JSON.stringify(teeAgent)
            );
            res.json({ agent: teeAgent, attestation: attestation });
        } catch (error) {
            logger.error('Failed to get TEE agent:', error);
            res.status(500).json({
                error: 'Failed to get TEE agent',
            });
        }
    });

    router.post('/logs', async (req: express.Request, res: express.Response) => {
        try {
            const query = req.body.query || {};
            const page = Number.parseInt(req.body.page) || 1;
            const pageSize = Number.parseInt(req.body.pageSize) || 10;

            const teeLogQuery: TeeLogQuery = {
                agentId: query.agentId || '',
                roomId: query.roomId || '',
                userId: query.userId || '',
                type: query.type || '',
                containsContent: query.containsContent || '',
                startTimestamp: query.startTimestamp || undefined,
                endTimestamp: query.endTimestamp || undefined,
            };
            const agentRuntime: IAgentRuntime = agents.values().next().value;
            const teeLogService = agentRuntime
                .getService<ITeeLogService>(ServiceType.TEE);
            const pageQuery = await teeLogService.getLogs(
                teeLogQuery,
                page,
                pageSize
            );
            const attestation = await teeLogService.generateAttestation(
                JSON.stringify(pageQuery)
            );
            res.json({
                logs: pageQuery,
                attestation: attestation,
            });
        } catch (error) {
            logger.error('Failed to get TEE logs:', error);
            res.status(500).json({
                error: 'Failed to get TEE logs',
            });
        }
    });

    return router;
} 