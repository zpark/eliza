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

export interface RoomParams {
    roomId: string;
}

export interface AgentNameParams extends AgentParams {
    name: string;
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