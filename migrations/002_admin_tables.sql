-- ElFilm D1 Database Schema
-- Migration 002: Admin tables for dashboard functionality

-- ============================================================
-- ADMIN TABLES
-- ============================================================

-- Admin users table (for future multi-user support)
CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'editor', -- 'admin', 'editor', 'viewer'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);

-- Audit log table for tracking all admin actions
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    action TEXT NOT NULL, -- 'create', 'update', 'delete'
    entity_type TEXT NOT NULL, -- 'movie', 'person', 'company', 'genre', 'tag'
    entity_id TEXT NOT NULL,
    details TEXT, -- JSON with change details
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES admin_users(id)
);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);  
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
