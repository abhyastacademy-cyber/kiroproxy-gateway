import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { configManager } from '../config/index.js';

interface SessionData {
  username: string;
  createdAt: number;
  expiresAt: number;
}

class SessionAuthManager {
  private sessions: Map<string, SessionData> = new Map();
  private readonly SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  /**
   * Authenticates user against server-side user ID and password.
   */
  public login(username?: string, password?: string): { success: boolean; token?: string; error?: string } {
    const config = configManager.getConfig();

    const expectedUser = (process.env.GATEWAY_ADMIN_USER || 'admin').trim();
    const expectedPassword = (process.env.GATEWAY_ADMIN_PASSWORD || process.env.PROXY_ADMIN_TOKEN || '').trim();

    const inputUser = (username || '').trim();
    const inputPassword = (password || '').trim();

    if (!inputUser || !inputPassword) {
      return { success: false, error: 'User ID and Password are required.' };
    }

    if (inputUser !== expectedUser || inputPassword !== expectedPassword) {
      return { success: false, error: 'Invalid User ID or Password.' };
    }

    // Generate secure session token
    const token = 'ksess_' + crypto.randomBytes(24).toString('hex');
    const now = Date.now();

    this.sessions.set(token, {
      username: inputUser,
      createdAt: now,
      expiresAt: now + this.SESSION_TTL_MS,
    });

    return { success: true, token };
  }

  public validateToken(token?: string): SessionData | null {
    if (!token) return null;
    const session = this.sessions.get(token);
    if (!session) return null;

    if (Date.now() > session.expiresAt) {
      this.sessions.delete(token);
      return null;
    }

    return session;
  }

  public logout(token?: string): boolean {
    if (!token) return false;
    return this.sessions.delete(token);
  }

  /**
   * Extracts token from Request (Bearer header, x-session-token, or query param)
   */
  public extractTokenFromRequest(req: Request): string | null {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }
    const sessionHeader = req.headers['x-session-token'];
    if (typeof sessionHeader === 'string') {
      return sessionHeader.trim();
    }
    if (typeof req.query.session_token === 'string') {
      return req.query.session_token;
    }
    return null;
  }

  /**
   * Checks if the request has valid session authentication OR valid admin token.
   */
  public isAuthorized(req: Request): boolean {
    const token = this.extractTokenFromRequest(req);
    if (token) {
      const session = this.validateToken(token);
      if (session) return true;

      // Check if token matches PROXY_ADMIN_TOKEN
      const config = configManager.getConfig();
      if (config.adminToken && token === config.adminToken) {
        return true;
      }
    }

    // Also check header x-admin-token
    const adminHeader = req.headers['x-admin-token'];
    const config = configManager.getConfig();
    if (config.adminToken && adminHeader === config.adminToken) {
      return true;
    }

    return false;
  }
}

export const sessionAuthManager = new SessionAuthManager();

/**
 * Express middleware to protect sensitive administrative and web API endpoints
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (sessionAuthManager.isAuthorized(req)) {
    return next();
  }
  return res.status(401).json({
    error: 'Authentication required. Please sign in with User ID and Password.',
    requiresLogin: true,
  });
}
