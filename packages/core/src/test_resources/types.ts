/**
 * Interface representing a user.
 * @typedef {Object} User
 * @property {string} id - The unique identifier for the user.
 * @property {string} [email] - The email address of the user (optional).
 * @property {string} [phone] - The phone number of the user (optional).
 * @property {string} [role] - The role of the user (optional).
 */
export interface User {
    id: string;
    email?: string;
    phone?: string;
    role?: string;
}
