/**
 * Database utility functions for D1
 */

import type { Env, D1Result } from './env';

/**
 * Execute a query and return all results
 */
export async function queryAll<T>(
    env: Env,
    query: string,
    ...params: unknown[]
): Promise<T[]> {
    try {
        const stmt = env.DB.prepare(query);
        const bound = params.length > 0 ? stmt.bind(...params) : stmt;
        const result = await bound.all<T>();

        if (!result.success) {
            throw new Error(`Query failed: ${result.error}`);
        }

        return result.results || [];
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
}

/**
 * Execute a query and return first result
 */
export async function queryFirst<T>(
    env: Env,
    query: string,
    ...params: unknown[]
): Promise<T | null> {
    try {
        const stmt = env.DB.prepare(query);
        const bound = params.length > 0 ? stmt.bind(...params) : stmt;
        const result = await bound.first<T>();

        return result;
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
}

/**
 * Execute a mutation query (INSERT, UPDATE, DELETE)
 */
export async function execute(
    env: Env,
    query: string,
    ...params: unknown[]
): Promise<D1Result> {
    try {
        const stmt = env.DB.prepare(query);
        const bound = params.length > 0 ? stmt.bind(...params) : stmt;
        const result = await bound.run();

        if (!result.success) {
            throw new Error(`Execute failed: ${result.error}`);
        }

        return result;
    } catch (error) {
        console.error('Database execute error:', error);
        throw error;
    }
}

/**
 * Execute multiple statements in a batch transaction
 */
export async function batch(
    env: Env,
    queries: Array<{ query: string; params?: unknown[] }>
): Promise<D1Result[]> {
    try {
        const statements = queries.map(({ query, params = [] }) => {
            const stmt = env.DB.prepare(query);
            return params.length > 0 ? stmt.bind(...params) : stmt;
        });

        const results = await env.DB.batch(statements);

        // Check if any failed
        const failed = results.find(r => !r.success);
        if (failed) {
            throw new Error(`Batch transaction failed: ${failed.error}`);
        }

        return results;
    } catch (error) {
        console.error('Database batch error:', error);
        throw error;
    }
}

/**
 * Helper to build WHERE clauses with filters
 */
export function buildWhereClause(
    filters: Record<string, unknown>
): { clause: string; params: unknown[] } {
    const conditions: string[] = [];
    const params: unknown[] = [];

    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) {
            if (Array.isArray(value)) {
                // IN clause
                const placeholders = value.map(() => '?').join(', ');
                conditions.push(`${key} IN (${placeholders})`);
                params.push(...value);
            } else {
                conditions.push(`${key} = ?`);
                params.push(value);
            }
        }
    }

    const clause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    return { clause, params };
}

/**
 * Helper to build ORDER BY clause
 */
export function buildOrderClause(
    orderBy?: string,
    direction: 'ASC' | 'DESC' = 'ASC'
): string {
    return orderBy ? ` ORDER BY ${orderBy} ${direction}` : '';
}

/**
 * Helper to build LIMIT/OFFSET clause
 */
export function buildPaginationClause(
    limit: number = 50,
    offset: number = 0
): { clause: string; params: unknown[] } {
    return {
        clause: ' LIMIT ? OFFSET ?',
        params: [limit, offset]
    };
}
