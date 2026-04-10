/**
 * Admin authentication middleware
 * Validates API key for admin routes
 */

import type { Context, Next } from 'hono';
import type { Env } from '../env';

export async function adminAuthMiddleware(
    c: Context<{ Bindings: Env }>,
    next: Next
) {
    const authHeader = c.req.header('Authorization');
    const adminKey = c.env.ADMIN_API_KEY;

    // Check if admin key is configured
    if (!adminKey) {
        return c.json({ error: 'Admin authentication not configured' }, 500);
    }

    // Validate authorization header
    if (!authHeader) {
        return c.json({ error: 'Missing authorization header' }, 401);
    }

    // Support both "Bearer TOKEN" and "TOKEN" formats
    const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : authHeader;

    // Validate token
    if (token !== adminKey) {
        return c.json({ error: 'Invalid admin credentials' }, 403);
    }

    // Authentication successful, proceed
    await next();
}
