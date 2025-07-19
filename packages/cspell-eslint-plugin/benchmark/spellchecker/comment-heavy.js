/**
 * Comment-heavy file for testing comment spell checking performance
 * This file contains extensive comments of various types including
 * JSDoc comments, inline comments, and multi-line comment blocks
 */

// =============================================================================
// Module: User Authentication System
// =============================================================================
// This module provides comprehensive user authentication functionality including
// login, logout, session management, and security features. It implements
// industry-standard security practices and supports multiple authentication
// methods.

/**
 * @module AuthenticationModule
 * @description Core authentication module for the application
 * @author Development Team
 * @since 1.0.0
 * @license MIT
 */

import crypto from 'node:crypto';

/**
 * Configuration object for authentication settings
 * 
 * @typedef {Object} AuthConfig
 * @property {number} sessionTimeout - Session timeout in milliseconds (default: 30 minutes)
 * @property {number} maxLoginAttempts - Maximum number of login attempts before lockout
 * @property {number} lockoutDuration - Duration of account lockout in milliseconds
 * @property {boolean} requireStrongPassword - Whether to enforce strong password requirements
 * @property {boolean} enableTwoFactor - Whether to enable two-factor authentication
 * @property {string} jwtSecret - Secret key for JWT token generation
 * @property {string} jwtAlgorithm - Algorithm used for JWT signing (default: HS256)
 */

/**
 * User credentials interface
 * 
 * @typedef {Object} Credentials
 * @property {string} username - The user's username or email address
 * @property {string} password - The user's password (will be hashed before storage)
 * @property {boolean} [rememberMe] - Optional flag to create persistent session
 */

/**
 * Authentication result object
 * 
 * @typedef {Object} AuthResult
 * @property {boolean} success - Whether authentication was successful
 * @property {string} [token] - JWT token if authentication succeeded
 * @property {Object} [user] - User object if authentication succeeded
 * @property {string} [error] - Error message if authentication failed
 * @property {number} [remainingAttempts] - Number of login attempts remaining
 */

// Default configuration values
// These can be overridden by passing a config object to the constructor
const DEFAULT_CONFIG = {
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000, // 15 minutes
    requireStrongPassword: true,
    enableTwoFactor: false,
    jwtSecret: process.env.JWT_SECRET || 'default-secret-change-in-production',
    jwtAlgorithm: 'HS256',
};

/**
 * Main authentication class that handles all authentication-related operations
 * 
 * @class AuthenticationService
 * @description This service provides methods for user authentication, session management,
 * password hashing, token generation, and various security features. It follows
 * security best practices including:
 * - Password hashing using bcrypt
 * - JWT token-based authentication
 * - Brute force protection
 * - Session management
 * - Two-factor authentication support (optional)
 * 
 * @example
 * ```javascript
 * const authService = new AuthenticationService({
 *     sessionTimeout: 60 * 60 * 1000, // 1 hour
 *     enableTwoFactor: true
 * });
 * 
 * const result = await authService.authenticate({
 *     username: 'john.doe@example.com',
 *     password: 'securePassword123'
 * });
 * ```
 */
class AuthenticationService {
    /**
     * Creates an instance of AuthenticationService
     * 
     * @constructor
     * @param {AuthConfig} config - Configuration object for the service
     */
    constructor(config = {}) {
        // Merge provided config with defaults
        this.config = { ...DEFAULT_CONFIG, ...config };

        // Initialize internal state
        this.loginAttempts = new Map(); // Track login attempts per user
        this.activeSessions = new Map(); // Track active user sessions
        this.lockedAccounts = new Map(); // Track locked accounts

        // Setup cleanup interval for expired sessions
        this.setupSessionCleanup();
    }

    /**
     * Authenticates a user with the provided credentials
     * 
     * This method performs the following steps:
     * 1. Validates the input credentials
     * 2. Checks if the account is locked
     * 3. Verifies the username exists
     * 4. Validates the password
     * 5. Generates authentication token
     * 6. Creates user session
     * 
     * @async
     * @param {Credentials} credentials - User credentials object
     * @returns {Promise<AuthResult>} Authentication result
     * @throws {Error} Throws error if database connection fails
     */
    async authenticate(credentials) {
        try {
            // Step 1: Validate input
            const validationResult = this.validateCredentials(credentials);
            if (!validationResult.valid) {
                return {
                    success: false,
                    error: validationResult.error,
                };
            }

            // Step 2: Check if account is locked
            if (this.isAccountLocked(credentials.username)) {
                return {
                    success: false,
                    error: 'Account is temporarily locked due to multiple failed login attempts',
                };
            }

            // Step 3: Verify user exists
            const user = await this.findUserByUsername(credentials.username);
            if (!user) {
                // Track failed attempt
                this.recordFailedAttempt(credentials.username);

                return {
                    success: false,
                    error: 'Invalid username or password',
                    remainingAttempts: this.getRemainingAttempts(credentials.username),
                };
            }

            // Step 4: Verify password
            const isPasswordValid = await this.verifyPassword(
                credentials.password,
                user.passwordHash
            );

            if (!isPasswordValid) {
                // Track failed attempt
                this.recordFailedAttempt(credentials.username);

                return {
                    success: false,
                    error: 'Invalid username or password',
                    remainingAttempts: this.getRemainingAttempts(credentials.username),
                };
            }

            // Step 5: Clear failed attempts on successful login
            this.clearFailedAttempts(credentials.username);

            // Step 6: Generate token and create session
            const token = this.generateToken(user);
            this.createSession(user, token, credentials.rememberMe);

            return {
                success: true,
                token,
                user: this.sanitizeUser(user),
            };

        } catch (error) {
            // Log error for debugging (in production, use proper logging service)
            console.error('Authentication error:', error);

            return {
                success: false,
                error: 'An error occurred during authentication',
            };
        }
    }

    /**
     * Validates user credentials format and requirements
     * 
     * @private
     * @param {Credentials} credentials - Credentials to validate
     * @returns {Object} Validation result with 'valid' boolean and optional 'error' message
     */
    validateCredentials(credentials) {
        // Check required fields
        if (!credentials.username || !credentials.password) {
            return {
                valid: false,
                error: 'Username and password are required',
            };
        }

        // Validate username format (email or alphanumeric)
        const usernameRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$|^[a-zA-Z0-9_]{3,20}$/;
        if (!usernameRegex.test(credentials.username)) {
            return {
                valid: false,
                error: 'Invalid username format',
            };
        }

        // Validate password strength if required
        if (this.config.requireStrongPassword) {
            const passwordStrength = this.checkPasswordStrength(credentials.password);
            if (!passwordStrength.isStrong) {
                return {
                    valid: false,
                    error: passwordStrength.message,
                };
            }
        }

        return { valid: true };
    }

    /**
     * Checks if a password meets strength requirements
     * 
     * Password must contain:
     * - At least 8 characters
     * - At least one uppercase letter
     * - At least one lowercase letter
     * - At least one number
     * - At least one special character
     * 
     * @private
     * @param {string} password - Password to check
     * @returns {Object} Object with 'isStrong' boolean and 'message' string
     */
    checkPasswordStrength(password) {
        const minLength = 8;
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

        if (password.length < minLength) {
            return {
                isStrong: false,
                message: `Password must be at least ${minLength} characters long`,
            };
        }

        if (!hasUpperCase || !hasLowerCase) {
            return {
                isStrong: false,
                message: 'Password must contain both uppercase and lowercase letters',
            };
        }

        if (!hasNumbers) {
            return {
                isStrong: false,
                message: 'Password must contain at least one number',
            };
        }

        if (!hasSpecialChar) {
            return {
                isStrong: false,
                message: 'Password must contain at least one special character',
            };
        }

        return {
            isStrong: true,
            message: 'Password meets all requirements',
        };
    }

    // Additional helper methods...

    /**
     * Sets up interval to clean expired sessions
     * This runs every 5 minutes to remove expired sessions from memory
     * 
     * @private
     */
    setupSessionCleanup() {
        setInterval(() => {
            const now = Date.now();

            // Iterate through all sessions and remove expired ones
            for (const [sessionId, session] of this.activeSessions) {
                if (session.expiresAt < now) {
                    this.activeSessions.delete(sessionId);
                    // In production, also clean from persistent storage
                }
            }
        }, 5 * 60 * 1000); // Run every 5 minutes
    }
}

// =============================================================================
// Utility Functions
// =============================================================================
// These utility functions provide additional functionality that can be used
// throughout the application. They are pure functions with no side effects.

/**
 * Generates a secure random string of specified length
 * This is useful for generating session IDs, tokens, or other random identifiers
 * 
 * @function generateSecureRandom
 * @param {number} length - Length of the random string to generate
 * @returns {string} Cryptographically secure random string
 * 
 * @example
 * const sessionId = generateSecureRandom(32);
 * // Returns something like: "a3f5b8c9d2e1f4g7h6i5j8k9l2m3n4o5"
 */
function generateSecureRandom(length) {
    return crypto.randomBytes(Math.ceil(length / 2))
        .toString('hex')
        .slice(0, length);
}

/**
 * Hashes a password using bcrypt algorithm
 * 
 * @async
 * @function hashPassword
 * @param {string} password - Plain text password to hash
 * @returns {Promise<string>} Hashed password
 */
async function hashPassword(password) {
    // In production, use bcrypt library
    // This is a simplified version for demonstration
    const salt = generateSecureRandom(16);
    const hash = crypto
        .createHash('sha256')
        .update(password + salt)
        .digest('hex');

    return `${salt}:${hash}`;
}

// Export the service and utility functions
export default {
    AuthenticationService,
    generateSecureRandom,
    hashPassword,
    DEFAULT_CONFIG,
};

/*
 * End of authentication module
 * 
 * Future enhancements to consider:
 * - OAuth integration for social login
 * - Biometric authentication support
 * - Risk-based authentication
 * - Password recovery mechanisms
 * - Multi-device session management
 * - Audit logging for security events
 * 
 * For questions or support, contact: security@example.com
 */