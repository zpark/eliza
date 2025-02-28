import { logger, type UUID } from '@elizaos/core';
import type { Response } from 'express';

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


import type { Character } from '@elizaos/core';
import { validateCharacterConfig } from '@elizaos/core';
import { createDatabaseAdapter } from '@elizaos/plugin-sql';
import type { Request } from 'express';

// Create database adapter from environment variables.
const dbAdapter = createDatabaseAdapter({
    dataDir: process.env.PGLITE_DATA_DIR,
    postgresUrl: process.env.POSTGRES_URL,
});

// Utility function to parse and validate character data.
function getValidatedCharacter(req: Request): Character {
    return validateCharacterConfig(req.body) as Character;
}

// Utility function to check if a character exists.
async function ensureCharacterExists(name: string, res: Response): Promise<Character | null> {
    const character = await dbAdapter.getCharacter(name);
    if (!character) {
        res.status(404).json({ error: 'Character not found' });
        return null;
    }
    return character;
}

