import type { Character } from '@elizaos/core';
import { logger, validateCharacterConfig } from '@elizaos/core';
import { createDatabaseAdapter } from '@elizaos/plugin-sql';
import type { Request, Response } from 'express';
import { Router } from 'express';
import { handleValidationError } from './api-utils';

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

export function characterRouter(): Router {
    const router = Router();

    // Base route for listing characters and creating new ones.
    router.route('/')
        .get(async (_req: Request, res: Response): Promise<void> => {
            try {
                const characters = await dbAdapter.listCharacters();
                res.json({ characters });
            } catch (error) {
                logger.error('Failed to list characters:', error);
                res.status(500).json({ error: 'Failed to retrieve characters' });
            }
        })
        .post(async (req: Request, res: Response): Promise<void> => {
            try {
                const character = getValidatedCharacter(req);
                const existing = await dbAdapter.getCharacter(character.name);
                if (existing) {
                    res.status(409).json({ error: 'Character already exists' });
                    return;
                }
                const newCharacter = await dbAdapter.createCharacter(character);
                res.status(201).json(newCharacter);
            } catch (error) {
                handleValidationError(error, res, 'Failed to create character');
            }
        });

    // Routes for managing a specific character.
    router.route('/:name')
        .get(async (req: Request<{ name: string }>, res: Response): Promise<void> => {
            try {
                const character = await dbAdapter.getCharacter(req.params.name);
                if (!character) {
                    res.status(404).json({ error: 'Character not found' });
                    return;
                }
                res.json(character);
            } catch (error) {
                logger.error('Failed to get character:', error);
                res.status(500).json({ error: 'Failed to retrieve character' });
            }
        })
        .put(async (req: Request<{ name: string }>, res: Response): Promise<void> => {
            try {
                if (!(await ensureCharacterExists(req.params.name, res))) return;
                const character = getValidatedCharacter(req);
                await dbAdapter.updateCharacter(req.params.name, character);
                res.json(character);
            } catch (error) {
                handleValidationError(error, res, 'Failed to update character');
            }
        })
        .delete(async (req: Request<{ name: string }>, res: Response): Promise<void> => {
            try {
                if (!(await ensureCharacterExists(req.params.name, res))) return;
                await dbAdapter.removeCharacter(req.params.name);
                res.status(204).end();
            } catch (error) {
                logger.error('Failed to remove character:', error);
                res.status(500).json({ error: 'Failed to delete character' });
            }
        });

    // Import route that updates an existing character or creates a new one.
    router.route('/import')
        .post(async (req: Request, res: Response): Promise<void> => {
            try {
                const character = getValidatedCharacter(req);
                const existing = await dbAdapter.getCharacter(character.name);
                if (existing) {
                    await dbAdapter.updateCharacter(character.name, character);
                    res.json(character);
                } else {
                    const newChar = await dbAdapter.createCharacter(character);
                    res.status(201).json(newChar);
                }
            } catch (error) {
                handleValidationError(error, res, 'Failed to import character');
            }
        });

    return router;
}
