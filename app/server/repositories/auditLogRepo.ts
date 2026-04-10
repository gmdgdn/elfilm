/**
 * Audit log repository
 * Tracks admin actions for accountability and debugging
 */

import type { Env } from '../env';
import { queryAll } from '../db';

// ============================================================
// TYPES
// ============================================================

export interface AuditLogEntry {
    id: number;
    user_id: string | null;
    action: 'create' | 'update' | 'delete';
    entity_type: string;
    entity_id: string;
    details: string | null; // JSON string
    created_at: string;
}

export interface CreateAuditLogParams {
    userId?: string;
    action: 'create' | 'update' | 'delete';
    entityType: string;
    entityId: string;
    details?: Record<string, any>;
}

// ============================================================
// REPOSITORY FUNCTIONS
// ============================================================

/**
 * Create an audit log entry
 */
export async function createAuditLog(
    env: Env,
    params: CreateAuditLogParams
): Promise<void> {
    const { userId, action, entityType, entityId, details } = params;

    const detailsJson = details ? JSON.stringify(details) : null;

    await env.DB.prepare(
        `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
         VALUES (?, ?, ?, ?, ?)`
    )
        .bind(userId || null, action, entityType, entityId, detailsJson)
        .run();
}

/**
 * Get recent audit log entries
 */
export async function getRecentAuditLogs(
    env: Env,
    limit: number = 50,
    offset: number = 0
): Promise<AuditLogEntry[]> {
    return queryAll<AuditLogEntry>(
        env,
        `SELECT * FROM audit_log
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        limit,
        offset
    );
}

/**
 * Get audit logs for a specific entity
 */
export async function getEntityAuditLogs(
    env: Env,
    entityType: string,
    entityId: string,
    limit: number = 20
): Promise<AuditLogEntry[]> {
    return queryAll<AuditLogEntry>(
        env,
        `SELECT * FROM audit_log
         WHERE entity_type = ? AND entity_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
        entityType,
        entityId,
        limit
    );
}

/**
 * Get audit logs by action type
 */
export async function getAuditLogsByAction(
    env: Env,
    action: 'create' | 'update' | 'delete',
    limit: number = 50
): Promise<AuditLogEntry[]> {
    return queryAll<AuditLogEntry>(
        env,
        `SELECT * FROM audit_log
         WHERE action = ?
         ORDER BY created_at DESC
         LIMIT ?`,
        action,
        limit
    );
}
