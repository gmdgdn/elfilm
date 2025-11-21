// API route handlers for ElFilm

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env, Film, PaginatedResponse, SearchResponse, HealthResponse, StatisticsResponse, ErrorResponse } from '../types';
import { Database, createDatabase } from '../db';
import { AIService, createAIService } from '../ai';

export function createRouter(): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();

  // CORS middleware
  app.use('*', cors());

  // Error handler middleware
  app.onError((err, c) => {
    const errorResponse: ErrorResponse = {
      error: {
        code: err.status?.toString() || '500',
        message: err.message || 'Internal Server Error',
        details: process.env.NODE_ENV === 'development' ? { stack: err.stack } : undefined,
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(errorResponse, (err.status as any) || 500);
  });

  // ============================================
  // Health & Status Routes
  // ============================================

  app.get('/health', async c => {
    const db = createDatabase(c.env);

    try {
      const stats = await db.getStatistics();

      const health: HealthResponse = {
        status: 'healthy',
        version: '1.0.0',
        environment: c.env.ENVIRONMENT || 'development',
        timestamp: new Date().toISOString(),
        services: {
          database: 'ok',
          ai: c.env.ENABLE_AI === 'true' ? 'ok' : 'disabled',
          storage: 'ok',
        },
      };

      return c.json(health);
    } catch (error) {
      const health: HealthResponse = {
        status: 'unhealthy',
        version: '1.0.0',
        environment: c.env.ENVIRONMENT || 'development',
        timestamp: new Date().toISOString(),
        services: {
          database: 'error',
          ai: 'error',
          storage: 'error',
        },
      };

      return c.json(health, 503);
    }
  });

  app.get('/stats', async c => {
    const db = createDatabase(c.env);

    try {
      const stats = await db.getStatistics();
      const response: StatisticsResponse = {
        total_films: stats.total_films || 0,
        total_people: stats.total_people || 0,
        total_genres: stats.total_genres || 0,
        total_tags: stats.total_tags || 0,
        years_covered: {
          min: stats.years_covered?.min || 1900,
          max: stats.years_covered?.max || 2024,
        },
        last_updated: new Date().toISOString(),
      };

      return c.json(response);
    } catch (error) {
      return c.json(
        { error: { code: '500', message: 'Failed to fetch statistics' } },
        500
      );
    }
  });

  // ============================================
  // Film Routes
  // ============================================

  app.get('/films', async c => {
    const db = createDatabase(c.env);

    try {
      const page = parseInt(c.req.query('page') || '1');
      const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
      const offset = (page - 1) * limit;

      const year = c.req.query('year');

      let films: Film[] = [];
      if (year) {
        films = (await db.getFilmsByYear(parseInt(year), limit, offset)) as any[];
      } else {
        films = (await c.env.DB.prepare(
          'SELECT * FROM films ORDER BY production_year DESC LIMIT ? OFFSET ?'
        )
          .bind(limit, offset)
          .all<Film>()) as any[];
      }

      const totalResult = await c.env.DB.prepare('SELECT COUNT(*) as count FROM films').first<{ count: number }>();
      const total = totalResult?.count || 0;

      const response: PaginatedResponse<Film> = {
        data: films,
        pagination: {
          page,
          limit,
          total,
          has_more: offset + limit < total,
        },
      };

      return c.json(response);
    } catch (error) {
      return c.json(
        { error: { code: '500', message: 'Failed to fetch films' } },
        500
      );
    }
  });

  app.get('/films/:slug', async c => {
    const db = createDatabase(c.env);
    const slug = c.req.param('slug');

    try {
      const film = await db.getFilmBySlug(slug, c.env);

      if (!film) {
        return c.json(
          { error: { code: '404', message: 'Film not found' } },
          404
        );
      }

      return c.json(film);
    } catch (error) {
      return c.json(
        { error: { code: '500', message: 'Failed to fetch film' } },
        500
      );
    }
  });

  app.get('/films/:slug/recommendations', async c => {
    const db = createDatabase(c.env);
    const slug = c.req.param('slug');

    try {
      // Get film by slug first
      const filmResult = await c.env.DB.prepare('SELECT id FROM films WHERE slug = ?')
        .bind(slug)
        .first<{ id: number }>();

      if (!filmResult) {
        return c.json(
          { error: { code: '404', message: 'Film not found' } },
          404
        );
      }

      if (c.env.ENABLE_AI !== 'true') {
        return c.json(
          {
            error: {
              code: '503',
              message: 'AI service not enabled',
            },
          },
          503
        );
      }

      const ai = createAIService(c.env, db);
      const recommendations = await ai.recommendSimilarFilms(filmResult.id, 5);

      return c.json({
        film_slug: slug,
        recommendations,
      });
    } catch (error) {
      return c.json(
        { error: { code: '500', message: 'Failed to generate recommendations' } },
        500
      );
    }
  });

  // ============================================
  // Search Routes
  // ============================================

  app.get('/search', async c => {
    const db = createDatabase(c.env);

    try {
      const q = c.req.query('q') || '';
      const page = parseInt(c.req.query('page') || '1');
      const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
      const offset = (page - 1) * limit;
      const searchType = c.req.query('type') || 'both'; // 'film', 'person', 'both'

      if (!q) {
        return c.json(
          { error: { code: '400', message: 'Query parameter "q" is required' } },
          400
        );
      }

      const results: any = {};

      if (searchType === 'film' || searchType === 'both') {
        results.films = await db.searchFilms(q, limit, offset);
      }

      if (searchType === 'person' || searchType === 'both') {
        results.people = await db.searchPeople(q, limit, offset);
      }

      // Record search for analytics
      try {
        await db.recordSearchQuery(
          q,
          (results.films?.length || 0) + (results.people?.length || 0),
          'en'
        );
      } catch (e) {
        // Silently ignore analytics errors
      }

      // Generate AI suggestions if enabled
      let suggestions: string[] = [];
      if (c.env.ENABLE_AI === 'true') {
        try {
          const ai = createAIService(c.env, db);
          suggestions = await ai.generateSearchSuggestions(q);
        } catch (e) {
          // Silently ignore AI errors
        }
      }

      const response: SearchResponse = {
        results,
        pagination: {
          page,
          limit,
          total: (results.films?.length || 0) + (results.people?.length || 0),
          has_more: offset + limit < ((results.films?.length || 0) + (results.people?.length || 0)),
        },
        query: q,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
      };

      return c.json(response);
    } catch (error) {
      return c.json(
        { error: { code: '500', message: 'Search failed' } },
        500
      );
    }
  });

  // ============================================
  // Filter Routes
  // ============================================

  app.get('/filter', async c => {
    const db = createDatabase(c.env);

    try {
      const yearMin = c.req.query('year_min') ? parseInt(c.req.query('year_min')!) : undefined;
      const yearMax = c.req.query('year_max') ? parseInt(c.req.query('year_max')!) : undefined;
      const genreIds = c.req.query('genres')
        ? (c.req.query('genres') as string).split(',').map(Number)
        : undefined;

      const page = parseInt(c.req.query('page') || '1');
      const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
      const offset = (page - 1) * limit;

      const films = await db.filterFilms(
        {
          year_min: yearMin,
          year_max: yearMax,
          genre_ids: genreIds,
        },
        limit,
        offset
      );

      return c.json({
        data: films,
        pagination: {
          page,
          limit,
          total: films.length,
          has_more: false,
        },
      });
    } catch (error) {
      return c.json(
        { error: { code: '500', message: 'Filter failed' } },
        500
      );
    }
  });

  // ============================================
  // Genre Routes
  // ============================================

  app.get('/genres', async c => {
    const db = createDatabase(c.env);

    try {
      const genres = await db.getGenres();
      return c.json({ genres });
    } catch (error) {
      return c.json(
        { error: { code: '500', message: 'Failed to fetch genres' } },
        500
      );
    }
  });

  // ============================================
  // Year Routes
  // ============================================

  app.get('/years', async c => {
    const db = createDatabase(c.env);

    try {
      const years = await db.getYears();
      return c.json({ years });
    } catch (error) {
      return c.json(
        { error: { code: '500', message: 'Failed to fetch years' } },
        500
      );
    }
  });

  // ============================================
  // People Routes
  // ============================================

  app.get('/people/:personId', async c => {
    const db = createDatabase(c.env);
    const personId = parseInt(c.req.param('personId'));

    try {
      const credits = await db.getPersonCredits(personId);

      if (!credits.person) {
        return c.json(
          { error: { code: '404', message: 'Person not found' } },
          404
        );
      }

      return c.json(credits);
    } catch (error) {
      return c.json(
        { error: { code: '500', message: 'Failed to fetch person' } },
        500
      );
    }
  });

  // 404 handler
  app.all('*', c => {
    return c.json(
      { error: { code: '404', message: 'Not found' } },
      404
    );
  });

  return app;
}
