// TypeScript file with complex AST nodes for performance testing
// This file includes interfaces, generics, decorators, and advanced TypeScript features

// Mock RxJS types for demonstration purposes
type Observable<T> = {
    subscribe(observer: (value: T) => void): void;
};

type Subject<T> = {
    next(value: T): void;
    asObservable(): Observable<T>;
};

type BehaviorSubject<T> = Subject<T> & {
    value: T;
};

// Mock implementations for the types
const createBehaviorSubject = <T>(initialValue: T): BehaviorSubject<T> => {
    const subscribers: Array<(value: T) => void> = [];
    let currentValue = initialValue;
    
    return {
        value: currentValue,
        next(value: T) {
            currentValue = value;
            subscribers.forEach(fn => fn(value));
        },
        asObservable() {
            return {
                subscribe(observer: (value: T) => void) {
                    observer(currentValue);
                    subscribers.push(observer);
                },
            };
        },
    };
};

const createSubject = <T>(): Subject<T> => {
    const subscribers: Array<(value: T) => void> = [];
    
    return {
        next(value: T) {
            subscribers.forEach(fn => fn(value));
        },
        asObservable() {
            return {
                subscribe(observer: (value: T) => void) {
                    subscribers.push(observer);
                },
            };
        },
    };
};

// Type definitions and interfaces
interface UserCredentials {
    username: string;
    password: string;
    rememberMe?: boolean;
}

interface AuthToken {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: 'Bearer';
}

interface User<T extends Record<string, unknown> = Record<string, never>> {
    id: string;
    username: string;
    email: string;
    profile: UserProfile;
    metadata: T;
    createdAt: Date;
    updatedAt: Date;
}

interface UserProfile {
    firstName: string;
    lastName: string;
    avatar?: string;
    bio?: string;
    preferences: UserPreferences;
}

interface UserPreferences {
    theme: 'light' | 'dark' | 'auto';
    language: string;
    timezone: string;
    notifications: NotificationSettings;
}

interface NotificationSettings {
    email: boolean;
    push: boolean;
    sms: boolean;
    frequency: 'instant' | 'daily' | 'weekly';
}

// Enums and constants
enum AuthStatus {
    Authenticated = 'AUTHENTICATED',
    Unauthenticated = 'UNAUTHENTICATED',
    Pending = 'PENDING',
    Error = 'ERROR',
}

const API_ENDPOINTS = {
    AUTH: {
        LOGIN: '/api/auth/login',
        LOGOUT: '/api/auth/logout',
        REFRESH: '/api/auth/refresh',
        VERIFY: '/api/auth/verify',
    },
    USER: {
        PROFILE: '/api/user/profile',
        PREFERENCES: '/api/user/preferences',
        AVATAR: '/api/user/avatar',
    },
} as const;

// Note: Decorators removed for TypeScript compatibility in benchmarking

// Generic type constraints
type Nullable<T> = T | undefined;
type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Service implementation with generics and advanced features
class AuthenticationService<T extends User = User> {
    private readonly authStatus$ = createBehaviorSubject<AuthStatus>(AuthStatus.Unauthenticated);
    private readonly currentUser$ = createBehaviorSubject<Nullable<T>>(undefined);
    private readonly errors$ = createSubject<Error>();
    
    private tokenStorage: Map<string, AuthToken> = new Map();
    private refreshTokenTimeout?: NodeJS.Timeout;
    
    constructor(
        private readonly httpClient: HttpClient,
        private readonly storage: StorageService,
        private readonly logger: LoggerService,
    ) {
        this.initializeAuth();
    }
    
    /**
     * Initialize authentication state from storage
     */
    private async initializeAuth(): Promise<void> {
        try {
            const storedToken = await this.storage.get<AuthToken>('auth_token');
            
            if (storedToken && this.isTokenValid(storedToken)) {
                await this.verifyAndSetUser(storedToken);
            }
        } catch (error) {
            this.logger.error('Failed to initialize auth', error);
            this.handleAuthError(error as Error);
        }
    }
    
    /**
     * Authenticate user with credentials
     */
    async login(credentials: UserCredentials): Promise<T> {
        this.authStatus$.next(AuthStatus.Pending);
        
        try {
            const response = await this.httpClient.post<{
                user: T;
                token: AuthToken;
            }>(API_ENDPOINTS.AUTH.LOGIN, credentials);
            
            const { user, token } = response.data;
            
            // Store token
            await this.storeAuthToken(token, credentials.rememberMe);
            
            // Update state
            this.currentUser$.next(user);
            this.authStatus$.next(AuthStatus.Authenticated);
            
            // Schedule token refresh
            this.scheduleTokenRefresh(token);
            
            this.logger.info(`User ${user.username} logged in successfully`);
            
            return user;
        } catch (error) {
            this.handleAuthError(error as Error);
            throw error;
        }
    }
    
    /**
     * Logout current user
     */
    async logout(): Promise<void> {
        try {
            await this.httpClient.post(API_ENDPOINTS.AUTH.LOGOUT, {});
        } catch (error) {
            this.logger.warn('Logout request failed', error);
        } finally {
            await this.clearAuthState();
        }
    }
    
    /**
     * Refresh authentication token
     */
    async refreshToken(): Promise<AuthToken> {
        const currentToken = await this.storage.get<AuthToken>('auth_token');
        
        if (!currentToken?.refreshToken) {
            throw new Error('No refresh token available');
        }
        
        const response = await this.httpClient.post<{
            token: AuthToken;
        }>(API_ENDPOINTS.AUTH.REFRESH, {
            refreshToken: currentToken.refreshToken,
        });
        
        const newToken = response.data.token;
        await this.storeAuthToken(newToken, true);
        
        return newToken;
    }
    
    /**
     * Get current user observable
     */
    getCurrentUser(): Observable<Nullable<T>> {
        return this.currentUser$.asObservable();
    }
    
    /**
     * Get authentication status observable
     */
    getAuthStatus(): Observable<AuthStatus> {
        return this.authStatus$.asObservable();
    }
    
    /**
     * Get authentication errors observable
     */
    getErrors(): Observable<Error> {
        return this.errors$.asObservable();
    }
    
    /**
     * Check if user is authenticated
     */
    isAuthenticated(): boolean {
        return this.authStatus$.value === AuthStatus.Authenticated;
    }
    
    /**
     * Update user profile
     */
    async updateProfile(updates: DeepPartial<UserProfile>): Promise<T> {
        const currentUser = this.currentUser$.value;
        
        if (!currentUser) {
            throw new Error('No user logged in');
        }
        
        const response = await this.httpClient.patch<{ user: T }>(
            `${API_ENDPOINTS.USER.PROFILE}/${currentUser.id}`,
            updates,
        );
        
        const updatedUser = response.data.user;
        this.currentUser$.next(updatedUser);
        
        return updatedUser;
    }
    
    /**
     * Store authentication token
     */
    private async storeAuthToken(token: AuthToken, persistent: boolean = false): Promise<void> {
        const storage = persistent ? this.storage : this.storage.session;
        await storage.set('auth_token', token);
        this.tokenStorage.set(token.accessToken, token);
    }
    
    /**
     * Clear authentication state
     */
    private async clearAuthState(): Promise<void> {
        // Cancel refresh timer
        if (this.refreshTokenTimeout) {
            clearTimeout(this.refreshTokenTimeout);
        }
        
        // Clear storage
        await this.storage.remove('auth_token');
        await this.storage.session.remove('auth_token');
        this.tokenStorage.clear();
        
        // Reset state
        this.currentUser$.next(undefined);
        this.authStatus$.next(AuthStatus.Unauthenticated);
    }
    
    /**
     * Verify token and set user
     */
    private async verifyAndSetUser(token: AuthToken): Promise<void> {
        const response = await this.httpClient.get<{ user: T }>(
            API_ENDPOINTS.AUTH.VERIFY,
            {
                headers: {
                    Authorization: `Bearer ${token.accessToken}`,
                },
            },
        );
        
        this.currentUser$.next(response.data.user);
        this.authStatus$.next(AuthStatus.Authenticated);
        this.scheduleTokenRefresh(token);
    }
    
    /**
     * Schedule token refresh
     */
    private scheduleTokenRefresh(token: AuthToken): void {
        const refreshTime = (token.expiresIn * 0.8) * 1000; // Refresh at 80% of expiry
        
        this.refreshTokenTimeout = setTimeout(async () => {
            try {
                await this.refreshToken();
            } catch (error) {
                this.logger.error('Token refresh failed', error);
                await this.clearAuthState();
            }
        }, refreshTime);
    }
    
    /**
     * Check if token is valid
     */
    private isTokenValid(token: AuthToken): boolean {
        // Simple validation - in reality would check expiry
        return !!token.accessToken && !!token.refreshToken;
    }
    
    /**
     * Handle authentication errors
     */
    private handleAuthError(error: Error): void {
        this.authStatus$.next(AuthStatus.Error);
        this.errors$.next(error);
        this.logger.error('Authentication error', error);
    }
}

// Type guards
function isUser<T extends User>(value: unknown): value is T {
    return Boolean(
        value && 
        typeof value === 'object' && 
        value !== null && 
        'id' in value && 
        typeof (value as { id: unknown }).id === 'string' && 
        'username' in value && 
        typeof (value as { username: unknown }).username === 'string'
    );
}

function isAuthToken(value: unknown): value is AuthToken {
    return Boolean(
        value && 
        typeof value === 'object' && 
        value !== null &&
        'accessToken' in value && 
        typeof (value as { accessToken: unknown }).accessToken === 'string' && 
        'refreshToken' in value && 
        typeof (value as { refreshToken: unknown }).refreshToken === 'string'
    );
}

// Utility types
type HttpClient = {
    get<T>(url: string, config?: unknown): Promise<{ data: T }>;
    post<T>(url: string, data?: unknown, config?: unknown): Promise<{ data: T }>;
    patch<T>(url: string, data?: unknown, config?: unknown): Promise<{ data: T }>;
};

type StorageService = {
    get<T>(key: string): Promise<T | undefined>;
    set<T>(key: string, value: T): Promise<void>;
    remove(key: string): Promise<void>;
    session: StorageService;
};

type LoggerService = {
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
};

// Export types and service
export {
    AuthenticationService,
    AuthStatus,
    AuthToken,
    isAuthToken,
    isUser,
    User,
    UserCredentials,
    UserPreferences,
    UserProfile,
};

export default AuthenticationService;