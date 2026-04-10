/**
 * Admin API routes
 * Protected endpoints for managing ElFilm content
 */

import { Hono } from 'hono';
import type { Env } from '../env';
import {
    getOverallStats,
    getMoviesByYearStats,
    getGenreDistribution,
    getTopActors,
    getTopDirectors,
    getRecentActivity,
    getMoviesByDecadeStats,
} from '../repositories/adminStatsRepo';
import {
    createAuditLog,
    getRecentAuditLogs,
    getEntityAuditLogs,
} from '../repositories/auditLogRepo';
import {
    listMoviesForVectorIndex,
    listMovies,
} from '../repositories/movieRepo';
import {
    listPeople,
} from '../repositories/personRepo';
import {
    listCompanies,
} from '../repositories/companyRepo';
import { getEmbedding } from '../repositories/vectorSearchRepo';
import { queryAll, queryFirst } from '../db';
import {
    createDatabaseRow,
    deleteDatabaseRow,
    getDatabaseEntitySchema,
    listDatabaseEntities,
    listDatabaseRows,
    updateDatabaseRow,
} from '../repositories/databaseConsoleRepo';
import {
    getSystemSettings,
    updateSystemSettings,
} from '../repositories/systemSettingsRepo';
import {
    enrichMovieById,
    enrichPersonArabicNameById,
    generateMovieTags,
    generateSearchCorpus,
    persistGeneratedMovieTags,
} from '../repositories/enrichment';

const admin = new Hono<{ Bindings: Env }>();
let operationalTablesReady = false;

async function ensureOperationalTables(env: Env) {
    if (operationalTablesReady) {
        return;
    }

    await env.DB.batch([
        env.DB.prepare(
            `CREATE TABLE IF NOT EXISTS admin_users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                name TEXT,
                role TEXT DEFAULT 'editor',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME
            )`
        ),
        env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email)'),
        env.DB.prepare(
            `CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                action TEXT NOT NULL,
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                details TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES admin_users(id)
            )`
        ),
        env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id)'),
        env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC)'),
        env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id)'),
        env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action)'),
        env.DB.prepare(
            `CREATE TABLE IF NOT EXISTS system_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                value_type TEXT DEFAULT 'json',
                description TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`
        ),
        env.DB.prepare(
            `INSERT OR IGNORE INTO system_settings (key, value, value_type, description) VALUES
             ('maintenance_mode', 'false', 'json', 'Enable maintenance mode for public traffic.'),
             ('debug_mode', 'false', 'json', 'Expose verbose diagnostics for admin troubleshooting.'),
             ('public_registration', 'false', 'json', 'Allow future public registration workflows.'),
             ('cache_ttl', '3600', 'json', 'Default cache TTL for archive responses, in seconds.')`
        ),
    ]);

    operationalTablesReady = true;
}

admin.use('*', async (c, next) => {
    await ensureOperationalTables(c.env);
    await next();
});

// ============================================================
// ANALYTICS & STATS
// ============================================================

// Get dashboard statistics
admin.get('/stats', async (c) => {
    try {
        const stats = await getOverallStats(c.env);
        return c.json({ stats });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Get movies by year analytics
admin.get('/analytics/movies-by-year', async (c) => {
    try {
        const limit = parseInt(c.req.query('limit') || '50');
        const data = await getMoviesByYearStats(c.env, limit);
        return c.json({ data });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Get movies by decade analytics
admin.get('/analytics/movies-by-decade', async (c) => {
    try {
        const data = await getMoviesByDecadeStats(c.env);
        return c.json({ data });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Get genre distribution
admin.get('/analytics/genres', async (c) => {
    try {
        const data = await getGenreDistribution(c.env);
        return c.json({ data });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Get top actors
admin.get('/analytics/top-actors', async (c) => {
    try {
        const limit = parseInt(c.req.query('limit') || '10');
        const data = await getTopActors(c.env, limit);
        return c.json({ data });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Get top directors
admin.get('/analytics/top-directors', async (c) => {
    try {
        const limit = parseInt(c.req.query('limit') || '10');
        const data = await getTopDirectors(c.env, limit);
        return c.json({ data });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Get recent activity
admin.get('/analytics/recent-activity', async (c) => {
    try {
        const limit = parseInt(c.req.query('limit') || '10');
        const data = await getRecentActivity(c.env, limit);
        return c.json({ data });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// ============================================================
// MOVIES MANAGEMENT
// ============================================================

// List all movies (admin version with more details)
admin.get('/movies', async (c) => {
    try {
        const limit = parseInt(c.req.query('limit') || '50');
        const offset = parseInt(c.req.query('offset') || '0');
        const orderBy = (c.req.query('orderBy') as any) || 'created_at';
        const direction = (c.req.query('direction') as any) || 'DESC';

        const movies = await listMovies(c.env, {
            orderBy,
            direction,
            limit,
            offset,
        });

        return c.json({ movies, count: movies.length, limit, offset });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Get single movie by ID
admin.get('/movies/:id', async (c) => {
    try {
        const id = c.req.param('id');
        // We can reuse getMovieBySlug if we had getMovieById, but for now we query directly
        const movie = await queryFirst(c.env, 'SELECT * FROM movies WHERE id = ?', id);

        if (!movie) {
            return c.json({ error: 'Movie not found' }, 404);
        }

        return c.json(movie);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Create new movie
admin.post('/movies', async (c) => {
    try {
        const body = await c.req.json();
        const {
            id,
            slug,
            title_ar,
            title_en,
            year,
            type,
            work_type,
            duration_minutes,
            summary_ar,
            country,
            language,
            rating,
        } = body;

        // Validate required fields
        if (!id || !slug || !title_ar || !year) {
            return c.json(
                { error: 'Missing required fields: id, slug, title_ar, year' },
                400
            );
        }

        // Insert movie
        await c.env.DB.prepare(
            `INSERT INTO movies (
                id, slug, title, title_ar, title_en, year, work_type, 
                duration_minutes, summary_ar, country, language, 
                rating
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
            .bind(
                id,
                slug,
                title_ar,
                title_ar,
                title_en || null,
                year,
                work_type || type || 'فيلم',
                duration_minutes || null,
                summary_ar || null,
                country || 'مصر',
                language || 'العربية',
                rating || 0
            )
            .run();

        // Create audit log
        await createAuditLog(c.env, {
            action: 'create',
            entityType: 'movie',
            entityId: id,
            details: { title_ar, year },
        });

        return c.json({ success: true, id }, 201);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Update movie
admin.put('/movies/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const body = await c.req.json();

        // Build dynamic UPDATE query
        const updates: string[] = [];
        const values: any[] = [];

        const allowedFields = [
            'slug',
            'title_ar',
            'title_en',
            'year',
            'work_type',
            'duration_minutes',
            'summary_ar',
            'country',
            'language',
            'rating',
        ];

        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updates.push(`${field} = ?`);
                values.push(body[field]);
            }
        }

        if (updates.length === 0) {
            return c.json({ error: 'No fields to update' }, 400);
        }

        // Add updated_at
        updates.push('updated_at = CURRENT_TIMESTAMP');

        // Add ID to values
        values.push(id);

        await c.env.DB.prepare(
            `UPDATE movies SET ${updates.join(', ')} WHERE id = ?`
        )
            .bind(...values)
            .run();

        // Create audit log
        await createAuditLog(c.env, {
            action: 'update',
            entityType: 'movie',
            entityId: id,
            details: body,
        });

        return c.json({ success: true });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Delete movie
admin.delete('/movies/:id', async (c) => {
    try {
        const id = c.req.param('id');

        // Get movie info before deletion
        const movie = await queryFirst(
            c.env,
            'SELECT title_ar FROM movies WHERE id = ?',
            id
        );

        if (!movie) {
            return c.json({ error: 'Movie not found' }, 404);
        }

        // Delete movie (cascade will handle related records)
        await c.env.DB.prepare('DELETE FROM movies WHERE id = ?')
            .bind(id)
            .run();

        // Create audit log
        await createAuditLog(c.env, {
            action: 'delete',
            entityType: 'movie',
            entityId: id,
            details: movie,
        });

        return c.json({ success: true });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// ============================================================
// PEOPLE MANAGEMENT
// ============================================================

// List all people
admin.get('/people', async (c) => {
    try {
        const limit = parseInt(c.req.query('limit') || '50');
        const offset = parseInt(c.req.query('offset') || '0');
        const orderBy = (c.req.query('orderBy') as any) || 'name_ar';

        const people = await listPeople(c.env, {
            orderBy,
            limit,
            offset,
        });

        return c.json({ people, count: people.length, limit, offset });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Get single person by ID
admin.get('/people/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const person = await queryFirst(c.env, 'SELECT * FROM people WHERE id = ?', id);

        if (!person) {
            return c.json({ error: 'Person not found' }, 404);
        }

        return c.json(person);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Create new person
admin.post('/people', async (c) => {
    try {
        const body = await c.req.json();
        const {
            id,
            slug,
            name_ar,
            name_en,
            full_name,
            bio_ar,
            birthdate,
            deathdate,
            country,
            profile_image,
        } = body;

        // Validate required fields
        if (!id || !slug || !name_ar) {
            return c.json(
                { error: 'Missing required fields: id, slug, name_ar' },
                400
            );
        }

        await c.env.DB.prepare(
            `INSERT INTO people (
                id, slug, name_ar, name_en, full_name, bio_ar,
                birthdate, deathdate, country, profile_image
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
            .bind(
                id,
                slug,
                name_ar,
                name_en || null,
                full_name || null,
                bio_ar || null,
                birthdate || null,
                deathdate || null,
                country || 'مصر',
                profile_image || null
            )
            .run();

        await createAuditLog(c.env, {
            action: 'create',
            entityType: 'person',
            entityId: id,
            details: { name_ar },
        });

        return c.json({ success: true, id }, 201);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Update person
admin.put('/people/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const body = await c.req.json();

        const updates: string[] = [];
        const values: any[] = [];

        const allowedFields = [
            'slug',
            'name_ar',
            'name_en',
            'full_name',
            'bio_ar',
            'birthdate',
            'deathdate',
            'country',
            'profile_image',
        ];

        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updates.push(`${field} = ?`);
                values.push(body[field]);
            }
        }

        if (updates.length === 0) {
            return c.json({ error: 'No fields to update' }, 400);
        }

        values.push(id);

        await c.env.DB.prepare(
            `UPDATE people SET ${updates.join(', ')} WHERE id = ?`
        )
            .bind(...values)
            .run();

        await createAuditLog(c.env, {
            action: 'update',
            entityType: 'person',
            entityId: id,
            details: body,
        });

        return c.json({ success: true });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Delete person
admin.delete('/people/:id', async (c) => {
    try {
        const id = c.req.param('id');

        const person = await queryFirst(
            c.env,
            'SELECT name_ar FROM people WHERE id = ?',
            id
        );

        if (!person) {
            return c.json({ error: 'Person not found' }, 404);
        }

        await c.env.DB.prepare('DELETE FROM people WHERE id = ?')
            .bind(id)
            .run();

        await createAuditLog(c.env, {
            action: 'delete',
            entityType: 'person',
            entityId: id,
            details: person,
        });

        return c.json({ success: true });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// ============================================================
// COMPANIES MANAGEMENT
// ============================================================

// List all companies
admin.get('/companies', async (c) => {
    try {
        const limit = parseInt(c.req.query('limit') || '50');
        const offset = parseInt(c.req.query('offset') || '0');
        const orderBy = (c.req.query('orderBy') as any) || 'name_ar';

        const companies = await listCompanies(c.env, {
            orderBy,
            limit,
            offset,
        });

        return c.json({ companies, count: companies.length, limit, offset });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Get single company by ID
admin.get('/companies/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const company = await queryFirst(c.env, 'SELECT * FROM companies WHERE id = ?', id);

        if (!company) {
            return c.json({ error: 'Company not found' }, 404);
        }

        return c.json(company);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Create new company
admin.post('/companies', async (c) => {
    try {
        const body = await c.req.json();
        const {
            id,
            slug,
            name_ar,
            name_en,
            kind,
            country,
            founded_year,
            closed_year,
            description_ar,
        } = body;

        if (!id || !slug || !name_ar) {
            return c.json(
                { error: 'Missing required fields: id, slug, name_ar' },
                400
            );
        }

        await c.env.DB.prepare(
            `INSERT INTO companies (
                id, slug, name_ar, name_en, kind, country,
                founded_year, closed_year, description_ar
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
            .bind(
                id,
                slug,
                name_ar,
                name_en || null,
                kind || null,
                country || 'مصر',
                founded_year || null,
                closed_year || null,
                description_ar || null
            )
            .run();

        await createAuditLog(c.env, {
            action: 'create',
            entityType: 'company',
            entityId: id,
            details: { name_ar },
        });

        return c.json({ success: true, id }, 201);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Update company
admin.put('/companies/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const body = await c.req.json();

        const updates: string[] = [];
        const values: any[] = [];

        const allowedFields = [
            'slug',
            'name_ar',
            'name_en',
            'kind',
            'country',
            'founded_year',
            'closed_year',
            'description_ar',
        ];

        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updates.push(`${field} = ?`);
                values.push(body[field]);
            }
        }

        if (updates.length === 0) {
            return c.json({ error: 'No fields to update' }, 400);
        }

        values.push(id);

        await c.env.DB.prepare(
            `UPDATE companies SET ${updates.join(', ')} WHERE id = ?`
        )
            .bind(...values)
            .run();

        await createAuditLog(c.env, {
            action: 'update',
            entityType: 'company',
            entityId: id,
            details: body,
        });

        return c.json({ success: true });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Delete company
admin.delete('/companies/:id', async (c) => {
    try {
        const id = c.req.param('id');

        const company = await queryFirst(
            c.env,
            'SELECT name_ar FROM companies WHERE id = ?',
            id
        );

        if (!company) {
            return c.json({ error: 'Company not found' }, 404);
        }

        await c.env.DB.prepare('DELETE FROM companies WHERE id = ?')
            .bind(id)
            .run();

        await createAuditLog(c.env, {
            action: 'delete',
            entityType: 'company',
            entityId: id,
            details: company,
        });

        return c.json({ success: true });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// ============================================================
// TAXONOMY MANAGEMENT (Genres & Tags)
// ============================================================

// List all genres
admin.get('/genres', async (c) => {
    try {
        const genres = await queryAll(
            c.env,
            `SELECT g.*, COUNT(mg.movie_id) as usage_count
             FROM genres g
             LEFT JOIN movie_genres mg ON mg.genre_id = g.id
             GROUP BY g.id
             ORDER BY g.name_ar`
        );

        return c.json({ genres });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Create genre
admin.post('/genres', async (c) => {
    try {
        const body = await c.req.json();
        const { slug, name_ar, name_en } = body;

        if (!slug || !name_ar) {
            return c.json(
                { error: 'Missing required fields: slug, name_ar' },
                400
            );
        }

        const result = await c.env.DB.prepare(
            'INSERT INTO genres (slug, name_ar, name_en) VALUES (?, ?, ?)'
        )
            .bind(slug, name_ar, name_en || null)
            .run();

        await createAuditLog(c.env, {
            action: 'create',
            entityType: 'genre',
            entityId: result.meta.last_row_id?.toString() || '',
            details: { name_ar },
        });

        return c.json({ success: true, id: result.meta.last_row_id }, 201);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Update genre
admin.put('/genres/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const body = await c.req.json();
        const { slug, name_ar, name_en } = body;

        const updates: string[] = [];
        const values: any[] = [];

        if (slug !== undefined) {
            updates.push('slug = ?');
            values.push(slug);
        }
        if (name_ar !== undefined) {
            updates.push('name_ar = ?');
            values.push(name_ar);
        }
        if (name_en !== undefined) {
            updates.push('name_en = ?');
            values.push(name_en);
        }

        if (updates.length === 0) {
            return c.json({ error: 'No fields to update' }, 400);
        }

        values.push(parseInt(id));

        await c.env.DB.prepare(
            `UPDATE genres SET ${updates.join(', ')} WHERE id = ?`
        )
            .bind(...values)
            .run();

        await createAuditLog(c.env, {
            action: 'update',
            entityType: 'genre',
            entityId: id,
            details: body,
        });

        return c.json({ success: true });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Delete genre
admin.delete('/genres/:id', async (c) => {
    try {
        const id = c.req.param('id');

        // Check if genre is in use
        const usage = await queryFirst<{ count: number }>(
            c.env,
            'SELECT COUNT(*) as count FROM movie_genres WHERE genre_id = ?',
            parseInt(id)
        );

        if (usage && usage.count > 0) {
            return c.json(
                {
                    error: `Cannot delete genre: used by ${usage.count} movie(s)`,
                },
                400
            );
        }

        await c.env.DB.prepare('DELETE FROM genres WHERE id = ?')
            .bind(parseInt(id))
            .run();

        await createAuditLog(c.env, {
            action: 'delete',
            entityType: 'genre',
            entityId: id,
        });

        return c.json({ success: true });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// List all tags
admin.get('/tags', async (c) => {
    try {
        const tags = await queryAll(
            c.env,
            `SELECT t.*, COUNT(mt.movie_id) as usage_count
             FROM tags t
             LEFT JOIN movie_tags mt ON mt.tag_id = t.id
             GROUP BY t.id
             ORDER BY t.name_ar`
        );

        return c.json({ tags });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Create tag
admin.post('/tags', async (c) => {
    try {
        const body = await c.req.json();
        const { slug, name_ar, name_en, category } = body;

        if (!slug || !name_ar) {
            return c.json(
                { error: 'Missing required fields: slug, name_ar' },
                400
            );
        }

        const result = await c.env.DB.prepare(
            'INSERT INTO tags (slug, name_ar, name_en, category) VALUES (?, ?, ?, ?)'
        )
            .bind(slug, name_ar, name_en || null, category || null)
            .run();

        await createAuditLog(c.env, {
            action: 'create',
            entityType: 'tag',
            entityId: result.meta.last_row_id?.toString() || '',
            details: { name_ar },
        });

        return c.json({ success: true, id: result.meta.last_row_id }, 201);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Update tag
admin.put('/tags/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const body = await c.req.json();

        const updates: string[] = [];
        const values: any[] = [];

        const allowedFields = ['slug', 'name_ar', 'name_en', 'category'];

        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updates.push(`${field} = ?`);
                values.push(body[field]);
            }
        }

        if (updates.length === 0) {
            return c.json({ error: 'No fields to update' }, 400);
        }

        values.push(parseInt(id));

        await c.env.DB.prepare(
            `UPDATE tags SET ${updates.join(', ')} WHERE id = ?`
        )
            .bind(...values)
            .run();

        await createAuditLog(c.env, {
            action: 'update',
            entityType: 'tag',
            entityId: id,
            details: body,
        });

        return c.json({ success: true });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Delete tag
admin.delete('/tags/:id', async (c) => {
    try {
        const id = c.req.param('id');

        const usage = await queryFirst<{ count: number }>(
            c.env,
            'SELECT COUNT(*) as count FROM movie_tags WHERE tag_id = ?',
            parseInt(id)
        );

        if (usage && usage.count > 0) {
            return c.json(
                { error: `Cannot delete tag: used by ${usage.count} movie(s)` },
                400
            );
        }

        await c.env.DB.prepare('DELETE FROM tags WHERE id = ?')
            .bind(parseInt(id))
            .run();

        await createAuditLog(c.env, {
            action: 'delete',
            entityType: 'tag',
            entityId: id,
        });

        return c.json({ success: true });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// ============================================================
// DATABASE STUDIO
// ============================================================

admin.get('/database/entities', async (c) => {
    try {
        const entities = await listDatabaseEntities(c.env);
        return c.json({ entities });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

admin.get('/database/entities/:entity', async (c) => {
    try {
        const entity = await getDatabaseEntitySchema(c.env, c.req.param('entity'));
        return c.json({ entity });
    } catch (error: any) {
        return c.json({ error: error.message }, 404);
    }
});

admin.get('/database/entities/:entity/rows', async (c) => {
    try {
        const entityKey = c.req.param('entity');
        const limit = parseInt(c.req.query('limit') || '25');
        const offset = parseInt(c.req.query('offset') || '0');
        const search = c.req.query('search') || '';
        const orderBy = c.req.query('orderBy') || undefined;
        const directionQuery = c.req.query('direction');
        const direction =
            directionQuery === 'ASC' || directionQuery === 'DESC'
                ? directionQuery
                : undefined;

        const payload = await listDatabaseRows(c.env, entityKey, {
            limit,
            offset,
            search,
            orderBy,
            direction,
        });

        return c.json(payload);
    } catch (error: any) {
        return c.json({ error: error.message }, 400);
    }
});

admin.post('/database/entities/:entity/rows', async (c) => {
    try {
        const entityKey = c.req.param('entity');
        const body = await c.req.json();
        const result = await createDatabaseRow(c.env, entityKey, body.values || {});

        await createAuditLog(c.env, {
            action: 'create',
            entityType: entityKey,
            entityId: JSON.stringify(result.primaryKey),
            details: result.row || body.values || {},
        });

        return c.json({ success: true, ...result }, 201);
    } catch (error: any) {
        return c.json({ error: error.message }, 400);
    }
});

admin.patch('/database/entities/:entity/rows', async (c) => {
    try {
        const entityKey = c.req.param('entity');
        const body = await c.req.json();
        const result = await updateDatabaseRow(c.env, entityKey, body.primaryKey || {}, body.values || {});

        await createAuditLog(c.env, {
            action: 'update',
            entityType: entityKey,
            entityId: JSON.stringify(result.primaryKey),
            details: body.values || {},
        });

        return c.json({ success: true, ...result });
    } catch (error: any) {
        return c.json({ error: error.message }, 400);
    }
});

admin.delete('/database/entities/:entity/rows', async (c) => {
    try {
        const entityKey = c.req.param('entity');
        const body = await c.req.json();
        const result = await deleteDatabaseRow(c.env, entityKey, body.primaryKey || {});

        await createAuditLog(c.env, {
            action: 'delete',
            entityType: entityKey,
            entityId: JSON.stringify(result.primaryKey),
            details: result.row || {},
        });

        return c.json({ success: true, ...result });
    } catch (error: any) {
        return c.json({ error: error.message }, 400);
    }
});

// ============================================================
// SETTINGS
// ============================================================

admin.get('/settings', async (c) => {
    try {
        const settings = await getSystemSettings(c.env);
        return c.json({ settings });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

admin.put('/settings', async (c) => {
    try {
        const body = await c.req.json();
        const settings = await updateSystemSettings(c.env, body || {});

        await createAuditLog(c.env, {
            action: 'update',
            entityType: 'settings',
            entityId: 'system',
            details: body || {},
        });

        return c.json({ success: true, settings });
    } catch (error: any) {
        return c.json({ error: error.message }, 400);
    }
});

// ============================================================
// VECTOR SEARCH MANAGEMENT
// ============================================================

// Generate embeddings for movies
admin.post('/vectorize/generate', async (c) => {
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    const afterId = c.req.query('afterId');

    try {
        const movies = await listMoviesForVectorIndex(c.env, limit, afterId);

        if (movies.length === 0) {
            return c.json({
                message: 'No movies found to process',
                count: 0,
                processed: 0,
                errors: 0,
                offset,
                nextOffset: offset,
                afterId: afterId || null,
                nextAfterId: afterId || null,
                hasMore: false,
            });
        }

        const vectors: any[] = [];
        let processed = 0;
        let errors = 0;

        for (const movie of movies) {
            try {
                const embedding = await getEmbedding(
                    c.env,
                    movie.search_document ||
                    movie.summary_ar ||
                    movie.story ||
                    movie.title_ar ||
                    movie.title ||
                    movie.id
                );

                vectors.push({
                    id: movie.id,
                    values: embedding,
                    metadata: {
                        title_ar: movie.title_ar,
                        title_en: movie.title_en || undefined,
                        year: Number(movie.year) || 0,
                        slug: movie.slug,
                        work_type: movie.work_type || undefined,
                        country: movie.country || undefined,
                        language: movie.language || undefined,
                        genres: movie.search_genres
                            ? movie.search_genres.split(',').map((value) => value.trim()).filter(Boolean)
                            : undefined,
                    },
                });
                processed++;
            } catch (e) {
                errors++;
                console.error(`Error processing ${movie.title_ar}:`, e);
            }
        }

        if (vectors.length > 0) {
            await c.env.VECTORIZE.upsert(vectors);
        }

        try {
            await createAuditLog(c.env, {
                action: 'update',
                entityType: 'vector_index',
                entityId: 'batch',
                details: { processed, errors, offset },
            });
        } catch (auditError) {
            console.warn('Vectorize batch completed without audit log persistence.', auditError);
        }

        const nextAfterId = movies.length > 0 ? movies[movies.length - 1].id : null;

        return c.json({
            success: true,
            processed,
            errors,
            offset,
            nextOffset: offset + limit,
            afterId: afterId || null,
            nextAfterId,
            hasMore: movies.length === limit,
        });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Get vector index status
admin.get('/vectorize/status', async (c) => {
    try {
        const info = await c.env.VECTORIZE.describe();
        const movieCount = await queryFirst<{ count: number }>(
            c.env,
            `SELECT COUNT(*) as count
             FROM movies
             WHERE COALESCE(NULLIF(summary_ar, ''), NULLIF(story, '')) IS NOT NULL`
        );

        return c.json({
            info: {
                vectorCount: (info as any).vectorCount ?? (info as any).vectorsCount ?? 0,
                dimensions: (info as any).dimensions ?? (info as any).config?.dimensions ?? 0,
                movieCount: movieCount?.count ?? 0,
                coverage:
                    (movieCount?.count ?? 0) > 0
                        ? Number((((info as any).vectorCount ?? (info as any).vectorsCount ?? 0) / (movieCount?.count ?? 1) * 100).toFixed(1))
                        : 0,
            },
        });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

admin.post('/generate-search-corpus', async (c) => {
    try {
        const generation = generateSearchCorpus(c.env).catch((error) => {
            console.error('Search corpus generation failed', error);
            return {
                movieCount: 0,
                peopleCount: 0,
                uploaded: 0,
            };
        });

        c.executionCtx.waitUntil(generation);

        await createAuditLog(c.env, {
            action: 'update',
            entityType: 'search_corpus',
            entityId: 'r2',
            details: { queued: true, prefix: 'search-corpus/' },
        });

        return c.json(
            {
                success: true,
                queued: true,
                prefix: 'search-corpus/',
            },
            202
        );
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

admin.post('/enrich-movie/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const result = await enrichMovieById(c.env, id);

        if (!result.found) {
            return c.json({ error: 'Movie not found or enrichment unavailable' }, 404);
        }

        await createAuditLog(c.env, {
            action: 'update',
            entityType: 'movie',
            entityId: id,
            details: {
                appliedFields: result.appliedFields,
                metadata: result.metadata ?? null,
            },
        });

        return c.json({ success: true, ...result });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

admin.post('/people/:id/wikidata-arabic-name', async (c) => {
    try {
        const id = c.req.param('id');
        const result = await enrichPersonArabicNameById(c.env, id);

        if (!result.found) {
            return c.json({ error: 'Person not found' }, 404);
        }

        if (result.updated) {
            await createAuditLog(c.env, {
                action: 'update',
                entityType: 'person',
                entityId: id,
                details: {
                    wikidataId: result.wikidataId,
                    tmdbPersonId: result.tmdbPersonId,
                    arabicName: result.arabicName,
                },
            });
        }

        return c.json({ success: true, ...result });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

admin.post('/movies/:id/generate-tags', async (c) => {
    try {
        const id = c.req.param('id');
        const movie = await queryFirst<{
            id: string;
            title_ar: string | null;
            title_en: string | null;
            title: string | null;
            summary_ar: string | null;
            story: string | null;
        }>(
            c.env,
            'SELECT id, title_ar, title_en, title, summary_ar, story FROM movies WHERE id = ?',
            id
        );

        if (!movie) {
            return c.json({ error: 'Movie not found' }, 404);
        }

        const synopsis = movie.summary_ar || movie.story || movie.title_ar || movie.title_en || movie.title || '';
        const tags = await generateMovieTags(c.env, synopsis);
        const result = await persistGeneratedMovieTags(c.env, movie.id, tags);

        await createAuditLog(c.env, {
            action: 'update',
            entityType: 'movie_tags',
            entityId: movie.id,
            details: {
                tags: result.tags,
                persisted: result.persisted,
            },
        });

        return c.json({ success: true, ...result });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// ============================================================
// AUDIT LOG
// ============================================================

// Get recent audit logs
admin.get('/audit-log', async (c) => {
    try {
        const limit = parseInt(c.req.query('limit') || '50');
        const offset = parseInt(c.req.query('offset') || '0');

        const logs = await getRecentAuditLogs(c.env, limit, offset);

        return c.json({ logs, count: logs.length, limit, offset });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Get audit logs for specific entity
admin.get('/audit-log/:entityType/:entityId', async (c) => {
    try {
        const entityType = c.req.param('entityType');
        const entityId = c.req.param('entityId');
        const limit = parseInt(c.req.query('limit') || '20');

        const logs = await getEntityAuditLogs(c.env, entityType, entityId, limit);

        return c.json({ logs });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

export default admin;
