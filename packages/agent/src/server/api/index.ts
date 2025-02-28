import type { IAgentRuntime } from '@elizaos/core';
import { getEnvVariable } from '@elizaos/core';
import bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';
import type { AgentServer } from '..';
import { agentRouter } from './agent.ts';
import { teeRouter } from './tee.ts';

export function createApiRouter(
    agents: Map<string, IAgentRuntime>,
    directClient: AgentServer
): express.Router {
    const router = express.Router();

    // Setup middleware
    router.use(cors());
    router.use(bodyParser.json());
    router.use(bodyParser.urlencoded({ extended: true }));
    router.use(
        express.json({
            limit: getEnvVariable('EXPRESS_MAX_PAYLOAD') || '100kb',
        })
    );

    // Base routes
    router.get('/', (_req, res) => {
        res.send('Welcome, this is the REST API!');
    });

    router.get('/hello', (_req, res) => {
        res.json({ message: 'Hello World!' });
    });

    // Mount sub-routers
    router.use('/agents', agentRouter(agents, directClient));
    router.use('/tee', teeRouter(agents));

    // Health check endpoints
    router.get('/health', (_req, res) => {
        const healthcheck = {
            status: 'OK',
            version: process.env.APP_VERSION || 'unknown',
            timestamp: new Date().toISOString(),
            dependencies: {
                agents: agents.size > 0 ? 'healthy' : 'no_agents'
            }
        };
        
        const statusCode = healthcheck.dependencies.agents === 'healthy' ? 200 : 503;
        res.status(statusCode).json(healthcheck);
    });

    // Status endpoint
    router.get('/status', (_req, res) => {
        res.json({
            status: 'operational',
            version: process.env.APP_VERSION || 'unknown',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            system: {
                platform: process.platform,
                memory: process.memoryUsage(),
                env: process.env.NODE_ENV
            },
            dependencies: {
                totalAgents: agents.size,
            }
        });
    });

    return router;
}

