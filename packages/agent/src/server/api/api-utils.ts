import { type UUID, validateUuid } from '@elizaos/core';
import type { Response } from 'express';
import { logger } from '@elizaos/core';

export interface UUIDParams {
    agentId: UUID;
    roomId?: UUID;
}

export interface AgentParams {
    agentId: string;
}

export interface AgentNameParams extends AgentParams {
    name: string;
}

export function validateUUIDParams(
    params: AgentParams | AgentNameParams,
    res: Response
): UUIDParams | null {
    const agentId = validateUuid(params.agentId);
    if (!agentId) {
        res.status(400).json({
            error: 'Invalid AgentId format. Expected to be a UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        });
        return null;
    }

    if ('name' in params) {
        return { agentId };
    }

    return { agentId };
}

export function handleValidationError(error: unknown, res: Response, context: string) {
    if (error instanceof Error) {
        logger.error(`${context}:`, error);
        res.status(400).json({
            error: error.message
        });
    } else {
        logger.error(`${context}:`, error);
        res.status(500).json({ 
            error: 'Unknown error' 
        });
    }
} 