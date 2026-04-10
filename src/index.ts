import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { semanticMovieSearch, findSimilarMovies } from '../app/server/repositories/vectorSearchRepo';
import { countMovies, getCuratedMovieList, getMovieBySlug, getMoviesReleasedOn, getRelatedMovies, listGenres, listMovies, searchMovies } from '../app/server/repositories/movieRepo';
import { countPeople, getPersonBySlug, listPeople, searchPeople, getPeopleBornOn, getPeopleDiedOn } from '../app/server/repositories/personRepo';
import { countCompanies, getCompanyBySlug, listCompanies, searchCompanies } from '../app/server/repositories/companyRepo';
import { adminAuthMiddleware } from '../app/server/middleware/adminMiddleware';
import adminRoutes from '../app/server/routes/adminRoutes';
import type { Env } from '../app/server/env';

const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('/*', cors());

function stripAssetPrefix(pathname: string) {
    return pathname
        .replace(/^\/+/, '')
        .replace(/^assets\/elfilm\//, '')
        .replace(/^assets\//, '');
}

// Serve public ElFilm image assets from R2 without exposing upstream sources.
app.get('/assets/*', async (c) => {
    const path = c.req.path.replace(/^\/+/, '');
    const candidateKeys = Array.from(
        new Set([
            path,
            stripAssetPrefix(c.req.path),
        ])
    );

    for (const key of candidateKeys) {
        const object = await c.env.R2.get(key);
        if (!object || !object.body) {
            continue;
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        headers.set('cache-control', 'public, max-age=31536000, immutable');

        return new Response(object.body, { headers });
    }

    if (c.env.ASSETS) {
        const assetResponse = await c.env.ASSETS.fetch(
            new Request(new URL(c.req.path, c.req.url), {
                method: c.req.raw.method,
                headers: c.req.raw.headers,
            })
        );

        if (assetResponse.ok) {
            const headers = new Headers(assetResponse.headers);
            if (!headers.has('cache-control')) {
                headers.set('cache-control', 'public, max-age=31536000, immutable');
            }

            return new Response(assetResponse.body, {
                status: assetResponse.status,
                statusText: assetResponse.statusText,
                headers,
            });
        }
    }

    return c.notFound();
});

// Root route
app.get('/', (c) => {
    return c.json({
        message: 'Welcome to ElFilm API',
        version: '1.0.0',
        endpoints: {
            movies: {
                detail: '/api/movies/:slug',
                list: '/api/movies',
                search: '/api/movies/search?q=query',
                similar: '/api/movies/:slug/similar',
                lists: '/api/movie-lists/:slug'
            },
            people: {
                detail: '/api/people/:slug',
                list: '/api/people',
                search: '/api/people/search?q=query',
                on_this_day: '/api/on-this-day?month=4&day=9'
            },
            companies: {
                detail: '/api/companies/:slug',
                list: '/api/companies',
                search: '/api/companies/search?q=query'
            },
            vector_search: '/api/vector-search?q=query',
            admin: '/api/admin/* (requires authentication)'
        }
    });
});

// Admin routes (protected with authentication middleware)
app.use('/api/admin/*', adminAuthMiddleware);
app.route('/api/admin', adminRoutes);


// ============================================================
// MOVIES API
// ============================================================

// Get a finite editorial movie list
app.get('/api/movie-lists/:slug', async (c) => {
    const slug = c.req.param('slug');

    try {
        const list = await getCuratedMovieList(c.env, slug);

        if (!list) {
            return c.json({ error: 'Movie list not found' }, 404);
        }

        return c.json({ list });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Search movies (MUST come before :slug route)
app.get('/api/movies/search', async (c) => {
    const query = c.req.query('q');
    const limit = parseInt(c.req.query('limit') || '20');

    if (!query) {
        return c.json({ error: 'Query parameter "q" is required' }, 400);
    }

    try {
        const movies = await searchMovies(c.env, query, limit);
        return c.json({ movies, count: movies.length });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Get movie by ID/slug
app.get('/api/movies/:slug', async (c) => {
    const slug = c.req.param('slug');

    try {
        const movie = await getMovieBySlug(c.env, slug);

        if (!movie) {
            return c.json({ error: 'Movie not found' }, 404);
        }

        return c.json({ movie });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Get similar movies (vector-based)
app.get('/api/movies/:slug/similar', async (c) => {
    const slug = c.req.param('slug');
    const limit = parseInt(c.req.query('limit') || '6');

    try {
        // First get the movie to get its ID
        const movie = await getMovieBySlug(c.env, slug);
        if (!movie) {
            return c.json({ error: 'Movie not found' }, 404);
        }

        let results = await findSimilarMovies(c.env, movie.id, limit);

        if (results.length === 0) {
            const related = await getRelatedMovies(c.env, movie.id, limit);
            results = related.map((relatedMovie) => ({
                ...relatedMovie,
                similarity: 0,
            }));
        }

        return c.json({
            results: results.map((movie) => ({
                movie,
                score: movie.similarity,
                similarity: movie.similarity,
            })),
        });
    } catch (error: any) {
        const movie = await getMovieBySlug(c.env, slug);
        if (!movie) {
            return c.json({ error: 'Movie not found' }, 404);
        }
        const related = await getRelatedMovies(c.env, movie.id, limit);
        return c.json({
            results: related.map((relatedMovie) => ({ movie: relatedMovie, score: 0, similarity: 0 })),
            fallback: true,
            warning: error.message,
        });
    }
});

// List movies with filters
app.get('/api/movies', async (c) => {
    const year = c.req.query('year');
    const yearMin = c.req.query('yearMin');
    const yearMax = c.req.query('yearMax');
    const decade = c.req.query('decade');
    const genreId = c.req.query('genreId');
    const orderBy = c.req.query('orderBy') as 'year' | 'title' | 'rating' || 'year';
    const direction = c.req.query('direction') as 'ASC' | 'DESC' || 'DESC';
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    try {
        const filters = {
            year: year ? parseInt(year) : undefined,
            yearMin: yearMin ? parseInt(yearMin) : undefined,
            yearMax: yearMax ? parseInt(yearMax) : undefined,
            decade: decade ? parseInt(decade) : undefined,
            genreId: genreId ? parseInt(genreId) : undefined,
        };

        const [movies, total] = await Promise.all([
            listMovies(c.env, {
                filters,
                orderBy,
                direction,
                limit,
                offset
            }),
            countMovies(c.env, filters),
        ]);

        return c.json({ movies, count: total, total, limit, offset });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// List genres for browse filters
app.get('/api/genres', async (c) => {
    try {
        const genres = await listGenres(c.env);
        return c.json({ genres, count: genres.length });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// ============================================================
// PEOPLE API
// ============================================================

// Search people (MUST come before :slug route)
app.get('/api/people/search', async (c) => {
    const query = c.req.query('q');
    const limit = parseInt(c.req.query('limit') || '20');

    if (!query) {
        return c.json({ error: 'Query parameter "q" is required' }, 400);
    }

    try {
        const people = await searchPeople(c.env, query, limit);
        return c.json({ people, count: people.length });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Get people born on this day
app.get('/api/people/born-on-this-day', async (c) => {
    const month = parseInt(c.req.query('month') || new Date().getMonth() + 1 + '');
    const day = parseInt(c.req.query('day') || new Date().getDate() + '');
    const limit = parseInt(c.req.query('limit') || '20');

    try {
        const people = await getPeopleBornOn(c.env, month, day, limit);
        return c.json({ people, count: people.length });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Get people died on this day
app.get('/api/people/died-on-this-day', async (c) => {
    const month = parseInt(c.req.query('month') || new Date().getMonth() + 1 + '');
    const day = parseInt(c.req.query('day') || new Date().getDate() + '');
    const limit = parseInt(c.req.query('limit') || '20');

    try {
        const people = await getPeopleDiedOn(c.env, month, day, limit);
        return c.json({ people, count: people.length });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Get person by ID/slug
app.get('/api/people/:slug', async (c) => {
    const slug = c.req.param('slug');

    try {
        const person = await getPersonBySlug(c.env, slug);

        if (!person) {
            return c.json({ error: 'Person not found' }, 404);
        }

        return c.json({ person });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// List people with filters
app.get('/api/people', async (c) => {
    const roleKind = c.req.query('roleKind');
    const orderBy = c.req.query('orderBy') as 'name_ar' | 'name_en' || 'name_ar';
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    try {
        const [people, total] = await Promise.all([
            listPeople(c.env, {
                roleKind,
                orderBy,
                limit,
                offset
            }),
            countPeople(c.env, roleKind),
        ]);

        return c.json({ people, count: total, total, limit, offset });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// ============================================================
// COMPANIES API
// ============================================================

// Search companies (MUST come before :slug route)
app.get('/api/companies/search', async (c) => {
    const query = c.req.query('q');
    const limit = parseInt(c.req.query('limit') || '20');

    if (!query) {
        return c.json({ error: 'Query parameter "q" is required' }, 400);
    }

    try {
        const companies = await searchCompanies(c.env, query, limit);
        return c.json({ companies, count: companies.length });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Get a consolidated "On This Day" payload
app.get('/api/on-this-day', async (c) => {
    const month = parseInt(c.req.query('month') || new Date().getMonth() + 1 + '');
    const day = parseInt(c.req.query('day') || new Date().getDate() + '');
    const limit = parseInt(c.req.query('limit') || '20');

    try {
        const [born, died, premieres] = await Promise.all([
            getPeopleBornOn(c.env, month, day, limit),
            getPeopleDiedOn(c.env, month, day, limit),
            getMoviesReleasedOn(c.env, month, day, limit),
        ]);

        return c.json({
            month,
            day,
            born,
            died,
            premieres,
            premieresSupported: premieres.length > 0,
            note: premieres.length > 0
                ? 'Premieres were resolved from the release_date column.'
                : 'Premiere tracking will appear once the release_date field is populated.',
        });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Get company by slug
app.get('/api/companies/:slug', async (c) => {
    const slug = c.req.param('slug');

    try {
        const company = await getCompanyBySlug(c.env, slug);

        if (!company) {
            return c.json({ error: 'Company not found' }, 404);
        }

        return c.json({ company });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// List companies with filters
app.get('/api/companies', async (c) => {
    const kind = c.req.query('kind');
    const orderBy = c.req.query('orderBy') as 'name_ar' | 'founded_year' || 'name_ar';
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    try {
        const [companies, total] = await Promise.all([
            listCompanies(c.env, {
                kind,
                orderBy,
                limit,
                offset
            }),
            countCompanies(c.env, kind),
        ]);

        return c.json({ companies, count: total, total, limit, offset });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// ============================================================
// VECTOR SEARCH API
// ============================================================

// Vector Search Route
app.get('/api/vector-search', async (c) => {
    const query = c.req.query('q');
    const yearMin = c.req.query('yearMin');
    const yearMax = c.req.query('yearMax');
    const workType = c.req.query('workType');
    const limit = parseInt(c.req.query('limit') || '20');
    const responseHeaders = {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400',
    };

    if (!query) {
        return c.json({ error: 'Query parameter "q" is required' }, 400);
    }

    try {
        const results = await semanticMovieSearch(c.env, {
            query,
            yearMin: yearMin ? parseInt(yearMin) : undefined,
            yearMax: yearMax ? parseInt(yearMax) : undefined,
            workType: workType || undefined,
            limit
        });

        return new Response(JSON.stringify({
            results: results.map((movie) => ({
                movie,
                score: movie.similarity,
                similarity: movie.similarity,
                source: movie.source ?? 'hybrid',
            })),
        }), { headers: responseHeaders });
    } catch (error: any) {
        const movies = await searchMovies(c.env, query, limit);
        return new Response(JSON.stringify({
            results: movies.map((movie) => ({ movie, score: 0, similarity: 0, source: 'keyword' })),
            fallback: true,
            warning: error.message,
        }), { headers: responseHeaders });
    }
});

export default app;
