import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { getEnvVariable } from '@elizaos/core';
import { agentRouter } from './agent.ts';
import { characterRouter } from './character.ts';
import { teeRouter } from './tee.ts';
import type { AgentServer } from '..';
import type { IAgentRuntime } from '@elizaos/core';

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
    router.use('/characters', characterRouter(agents));
    router.use('/tee', teeRouter(agents));

    return router;
}

