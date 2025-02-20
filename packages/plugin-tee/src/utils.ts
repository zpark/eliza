import { createHash } from 'node:crypto';

export function hexToUint8Array(hex: string) {
    hex = hex.trim();
    if (!hex) {
        throw new Error('Invalid hex string');
    }
    if (hex.startsWith('0x')) {
        hex = hex.substring(2);
    }
    if (hex.length % 2 !== 0) {
        throw new Error('Invalid hex string');
    }

    const array = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        const byte = parseInt(hex.slice(i, i + 2), 16);
        if (isNaN(byte)) {
            throw new Error('Invalid hex string');
        }
        array[i / 2] = byte;
    }
    return array;
}

// Function to calculate SHA-256 and return a Buffer (32 bytes)
export function calculateSHA256(input: string): Buffer {
    const hash = createHash('sha256');
    hash.update(input);
    return hash.digest();
}
