/**
 * Parses a string to determine its boolean equivalent.
 * @param {string} text - The input text to parse.
 * @returns {boolean|null} - Returns `true` for affirmative inputs, `false` for negative inputs, and `null` for unrecognized inputs or null/undefined.
 */
export const parseBooleanFromText = (text: string) => {
    if (!text) return null; // Handle null or undefined input

    const affirmative = ["YES", "Y", "TRUE", "T", "1", "ON", "ENABLE"];
    const negative = ["NO", "N", "FALSE", "F", "0", "OFF", "DISABLE"];

    const normalizedText = text?.trim().toUpperCase();

    if (affirmative.includes(normalizedText)) {
        return true;
    }
    if (negative.includes(normalizedText)) {
        return false;
    }

    return null; // Return null for unrecognized inputs
}; 