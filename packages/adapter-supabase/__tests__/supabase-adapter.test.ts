import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseDatabaseAdapter } from '../src';
import { type UUID, elizaLogger } from '@elizaos/core';
import { createClient } from '@supabase/supabase-js';

// Mock the elizaLogger
vi.mock('@elizaos/core', async () => {
    const actual = await vi.importActual('@elizaos/core');
    return {
        ...actual as any,
        elizaLogger: {
            error: vi.fn()
        }
    };
});

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    maybeSingle: vi.fn(() => Promise.resolve({ data: { id: 'test-room-id' }, error: null })),
                })),
            })),
        })),
    })),
}));

describe('SupabaseDatabaseAdapter', () => {
    let adapter: SupabaseDatabaseAdapter;
    const mockSupabaseUrl = 'https://test.supabase.co';
    const mockSupabaseKey = 'test-key';
    const mockSupabase = {
        from: vi.fn(() => mockSupabase),
        select: vi.fn(() => mockSupabase),
        eq: vi.fn(() => mockSupabase),
        maybeSingle: vi.fn(),
        single: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        adapter = new SupabaseDatabaseAdapter(mockSupabaseUrl, mockSupabaseKey);
        // @ts-ignore - we're mocking the implementation
        adapter.supabase = mockSupabase;
    });

    describe('getRoom', () => {
        it('should return room ID when room exists', async () => {
            const roomId = 'test-room-id' as UUID;
            mockSupabase.maybeSingle.mockResolvedValueOnce({ 
                data: { id: roomId }, 
                error: null 
            });

            const result = await adapter.getRoom(roomId);
            
            expect(mockSupabase.from).toHaveBeenCalledWith('rooms');
            expect(mockSupabase.select).toHaveBeenCalledWith('id');
            expect(mockSupabase.eq).toHaveBeenCalledWith('id', roomId);
            expect(result).toBe(roomId);
        });

        it('should return null when room does not exist', async () => {
            mockSupabase.maybeSingle.mockResolvedValueOnce({ 
                data: null, 
                error: null 
            });

            const roomId = 'non-existent-room' as UUID;
            const result = await adapter.getRoom(roomId);
            
            expect(result).toBeNull();
        });

        it('should return null and log error when there is a database error', async () => {
            const error = { message: 'Database error' };
            mockSupabase.maybeSingle.mockResolvedValueOnce({ 
                data: null, 
                error 
            });

            const roomId = 'error-room' as UUID;
            const result = await adapter.getRoom(roomId);
            
            expect(result).toBeNull();
            expect(elizaLogger.error).toHaveBeenCalledWith(`Error getting room: ${error.message}`);
        });
    });

    describe('getParticipantsForAccount', () => {
        const mockParticipants = [
            { id: 'participant-1', userId: 'user-1' },
            { id: 'participant-2', userId: 'user-1' }
        ];

        it('should return participants when they exist', async () => {
            mockSupabase.eq.mockResolvedValueOnce({ 
                data: mockParticipants,
                error: null 
            });

            const userId = 'user-1' as UUID;
            const result = await adapter.getParticipantsForAccount(userId);
            
            expect(mockSupabase.from).toHaveBeenCalledWith('participants');
            expect(mockSupabase.select).toHaveBeenCalledWith('*');
            expect(mockSupabase.eq).toHaveBeenCalledWith('userId', userId);
            expect(result).toEqual(mockParticipants);
        });

        it('should throw error when database error occurs', async () => {
            const error = { message: 'Database error' };
            mockSupabase.eq.mockResolvedValueOnce({ 
                data: null,
                error
            });

            const userId = 'error-user' as UUID;
            
            await expect(adapter.getParticipantsForAccount(userId))
                .rejects
                .toThrow(`Error getting participants for account: ${error.message}`);
        });
    });
});
