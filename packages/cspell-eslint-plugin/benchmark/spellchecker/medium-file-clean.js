// Medium-sized file for typical use case performance testing
// This file represents a typical JavaScript module with various features

import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';

// Configuration constants
const DEFAULT_TIMEOUT = 5000;
const MAX_RETRIES = 3;
const CACHE_DURATION = 60_000; // 1 minute in milliseconds

const __dirname = path.dirname(new URL(import.meta.url).pathname);

/**
 * UserService class handles user-related operations
 * including authentication, profile management, and data persistence
 */
class UserService extends EventEmitter {
    constructor(options = {}) {
        super();
        this.config = {
            timeout: options.timeout || DEFAULT_TIMEOUT,
            retries: options.retries || MAX_RETRIES,
            cacheEnabled: options.cacheEnabled !== false,
        };
        this.cache = new Map();
        this.initializeService();
    }

    /**
     * Initialize the service with required dependencies
     */
    async initializeService() {
        try {
            // Setup database connection
            await this.connectDatabase();

            // Load configuration from file
            const configPath = path.join(__dirname, 'config.json');
            const configData = await fs.readFile(configPath, 'utf8');
            this.settings = JSON.parse(configData);

            this.emit('initialized', { timestamp: Date.now() });
        } catch (error) {
            console.error('Failed to initialize UserService:', error.message);
            this.emit('error', error);
        }
    }

    /**
     * Authenticate a user with credentials
     * @param {string} username - User's username
     * @param {string} password - User's password
     * @returns {Promise<Object>} Authentication result
     */
    async authenticateUser(username, password) {
        // Check cache first
        const cacheKey = `auth:${username}`;
        if (this.config.cacheEnabled && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < CACHE_DURATION) {
                return cached.data;
            }
        }

        // Validate input
        if (!username || !password) {
            throw new Error('Username and password are required');
        }

        // Simulate authentication logic
        const result = await this.performAuthentication(username, password);

        // Cache successful authentication
        if (result.success && this.config.cacheEnabled) {
            this.cache.set(cacheKey, {
                data: result,
                timestamp: Date.now(),
            });
        }

        return result;
    }

    /**
     * Get user profile information
     * @param {string} userId - User ID
     * @returns {Promise<Object>} User profile data
     */
    async getUserProfile(userId) {
        const profile = await this.fetchUserData(userId);

        // Transform data for client
        return {
            id: profile.id,
            username: profile.username,
            email: profile.email,
            displayName: profile.displayName || profile.username,
            createdAt: profile.createdAt,
            lastLogin: profile.lastLogin,
            preferences: this.sanitizePreferences(profile.preferences),
        };
    }

    /**
     * Update user preferences
     * @param {string} userId - User ID
     * @param {Object} preferences - New preferences
     */
    async updatePreferences(userId, preferences) {
        // Validate preferences
        const validatedPreferences = this.validatePreferences(preferences);

        // Update in database
        await this.updateUserData(userId, { preferences: validatedPreferences });

        // Clear cache
        this.clearUserCache(userId);

        this.emit('preferencesUpdated', { userId, preferences: validatedPreferences });
    }

    // Private helper methods
    async connectDatabase() {
        // Simulated database connection
        return new Promise((resolve) => {
            setTimeout(resolve, 100);
        });
    }

    async performAuthentication(username) {
        // Simulated authentication
        return {
            success: true,
            userId: `user_${username}`,
            token: this.generateToken(),
        };
    }

    generateToken() {
        return Array(32)
            .fill(0)
            .map(() => Math.random().toString(36).charAt(2))
            .join('');
    }

    sanitizePreferences(preferences = {}) {
        const defaults = {
            theme: 'light',
            language: 'en',
            notifications: true,
        };
        return { ...defaults, ...preferences };
    }

    validatePreferences(preferences) {
        const allowed = ['theme', 'language', 'notifications', 'timezone'];
        const validated = {};

        for (const key of allowed) {
            if (key in preferences) {
                validated[key] = preferences[key];
            }
        }

        return validated;
    }

    clearUserCache(userId) {
        for (const [key] of this.cache) {
            if (key.includes(userId)) {
                this.cache.delete(key);
            }
        }
    }
}

// Export the service
export default UserService;