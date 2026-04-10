/**
 * Movie repository - Data access layer for movies
 */

import type { Env } from '../env';
import { queryAll, queryFirst, buildWhereClause, buildOrderClause, buildPaginationClause } from '../db';
import {
    TOP_100_EGYPTIAN_MOVIES,
    TOP_100_EGYPTIAN_MOVIES_SOURCE_URL,
    type Top100EgyptianMovieEntry,
} from '../data/top100EgyptianMovies';

// ============================================================
// TYPES
// ============================================================

// Simplified Movie interface matching current database schema
export interface Movie {
    id: string;
    slug?: string;
    title: string;
    title_ar?: string;
    title_en?: string | null;
    year: number | string;
    work_type?: string | null;
    poster_url: string | null;
    story: string | null;
    summary_ar?: string | null;
    duration: string | null;
    duration_minutes?: number | null;
    rating: string | null;
    genres: string | null;
    country?: string | null;
    language?: string | null;
    release_date?: string | null;
}

// Simplified MovieWithRelations for current schema
export interface MovieWithRelations extends Movie {
    cast?: any[];
    crew?: any[];
    watch_links?: WatchLink[];
    news?: MovieArticle[];
    people?: PersonCredit[];
    companies?: CompanyCredit[];
    tags?: Tag[];
    assets?: Asset[];
}

export interface WatchLink {
    id: number;
    provider_key?: string | null;
    platform: string;
    url: string;
    embed_url?: string | null;
    embed_type?: string | null;
    source_kind?: string | null;
    title: string | null;
    confidence?: number | null;
    verified_at?: string | null;
    is_official?: number | null;
}

export interface PersonCredit {
    id: string;
    slug: string;
    name_ar: string;
    name_en: string | null;
    profile_image: string | null;
    role_kind: string;
    role_credit: string | null;
    billing_order: number;
}

export interface CompanyCredit {
    id: string;
    slug: string;
    name_ar: string;
    name_en: string | null;
    role_kind: string;
}

export interface Genre {
    id: number;
    slug: string;
    name_ar: string;
    name_en: string | null;
}

export interface Tag {
    id: number;
    slug: string;
    name_ar: string;
    name_en: string | null;
    category: string | null;
}

export interface Asset {
    id: number;
    kind: string;
    url: string;
    r2_key: string;
    width: number | null;
    height: number | null;
}

export interface MovieFilters {
    year?: number;
    yearMin?: number;
    yearMax?: number;
    decade?: number;
    genreId?: number;
    tagId?: number;
    type?: string;
}

export interface MovieListOptions {
    filters?: MovieFilters;
    orderBy?: 'year' | 'title' | 'rating';
    direction?: 'ASC' | 'DESC';
    limit?: number;
    offset?: number;
}

export interface SearchableMovie extends Movie {
    search_genres?: string | null;
    cast_names?: string | null;
    crew_names?: string | null;
    tag_names?: string | null;
    company_names?: string | null;
    search_document?: string;
    fts_rank?: number | null;
}

export interface CuratedMovieListEntry extends Top100EgyptianMovieEntry {
    movie: Movie | null;
}

export interface CuratedMovieList {
    slug: string;
    title_ar: string;
    description_ar: string;
    source_name: string;
    source_url: string;
    entries: CuratedMovieListEntry[];
    count: number;
    matched_count: number;
}

interface CuratedMovieListRow extends Movie {
    list_rank: number;
    list_title_ar: string;
    list_year: number;
    list_director: string | null;
    list_lookup_title_ar: string | null;
}

// ============================================================
// REPOSITORY FUNCTIONS
// ============================================================

const PUBLIC_POSTER_BASE_URL = 'https://film.gmd.gdn/assets/elfilm/posters';
const MOVIE_LIST_SELECT = `
    SELECT
        id,
        slug,
        title,
        title_ar,
        title_en,
        year,
        work_type,
        poster_url,
        NULL as story,
        NULL as summary_ar,
        duration,
        duration_minutes,
        rating,
        genres,
        country,
        language,
        NULL as release_date
    FROM movies`;

function sanitizeMovieText(value: string | null | undefined): string | null | undefined {
    if (typeof value !== 'string') {
        return value;
    }

    return value
        .replace(/\s*(?:\.{3}|…)?\s*اقرأ المزيد\s*/g, ' ')
        .replace(/\s+([،؛:.!?])/g, '$1')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function sanitizeMovie<T extends Movie>(movie: T): T {
    return {
        ...movie,
        poster_url: movie.poster_url || `${PUBLIC_POSTER_BASE_URL}/${movie.id}.jpg`,
        story: sanitizeMovieText(movie.story) ?? null,
        summary_ar: sanitizeMovieText(movie.summary_ar) ?? null,
    };
}

function buildMovieFilters(filters: MovieFilters): { whereClause: string; params: unknown[] } {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.year) {
        conditions.push('year = ?');
        params.push(filters.year);
    }
    if (filters.yearMin) {
        conditions.push('year >= ?');
        params.push(filters.yearMin);
    }
    if (filters.yearMax) {
        conditions.push('year <= ?');
        params.push(filters.yearMax);
    }
    if (filters.decade) {
        const decadeStart = filters.decade;
        const decadeEnd = filters.decade + 9;
        conditions.push('year >= ? AND year <= ?');
        params.push(decadeStart, decadeEnd);
    }
    if (filters.type) {
        conditions.push('work_type = ?');
        params.push(filters.type);
    }
    if (filters.genreId) {
        conditions.push(`id IN (
      SELECT movie_id FROM movie_genres WHERE genre_id = ?
    )`);
        params.push(filters.genreId);
    }
    if (filters.tagId) {
        conditions.push(`id IN (
      SELECT movie_id FROM movie_tags WHERE tag_id = ?
    )`);
        params.push(filters.tagId);
    }

    return {
        whereClause: conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '',
        params,
    };
}

function tokenizeSearchQuery(query: string): string[] {
    return Array.from(
        new Set(
            query
                .trim()
                .toLowerCase()
                .match(/[\p{L}\p{N}]+/gu) ?? []
        )
    ).slice(0, 8);
}

function buildFtsMatchQuery(query: string): string {
    const tokens = tokenizeSearchQuery(query);

    if (tokens.length === 0) {
        return query.trim().replace(/"/g, '""');
    }

    const phrases = [
        `"${query.trim().replace(/"/g, '""')}"`,
        ...tokens.map((token) => `${token}*`),
    ];

    return Array.from(new Set(phrases)).join(' OR ');
}

function buildSearchDocument(movie: Partial<SearchableMovie>): string {
    const sections = [
        movie.title_ar ? `العنوان: ${movie.title_ar}` : null,
        movie.title_en ? `English title: ${movie.title_en}` : null,
        movie.title ? `Title: ${movie.title}` : null,
        movie.year ? `سنة الإنتاج: ${movie.year}` : null,
        movie.search_genres ? `التصنيفات: ${movie.search_genres}` : null,
        movie.tag_names ? `وسوم مرتبطة: ${movie.tag_names}` : null,
        movie.cast_names ? `بطولة: ${movie.cast_names}` : null,
        movie.crew_names ? `صناع العمل: ${movie.crew_names}` : null,
        movie.company_names ? `إنتاج وتوزيع: ${movie.company_names}` : null,
        movie.summary_ar ? `ملخص: ${movie.summary_ar}` : null,
        movie.story ? `القصة: ${movie.story}` : null,
    ];

    return sections.filter(Boolean).join('\n');
}

function buildSearchFilterClause(yearMin?: number, yearMax?: number) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (yearMin) {
        conditions.push('m.year >= ?');
        params.push(yearMin);
    }

    if (yearMax) {
        conditions.push('m.year <= ?');
        params.push(yearMax);
    }

    return {
        clause: conditions.length > 0 ? ` AND ${conditions.join(' AND ')}` : '',
        params,
    };
}

function sqlString(value?: string | null): string {
    if (value === null || value === undefined) {
        return 'NULL';
    }

    return `'${value.replace(/'/g, "''")}'`;
}

async function getMovieColumnNames(env: Env): Promise<Set<string>> {
    const columns = await queryAll<{ name: string }>(env, 'PRAGMA table_info(movies)');
    return new Set(columns.map((column) => column.name));
}

export async function getSearchableMoviesByIds(
    env: Env,
    movieIds: string[]
): Promise<SearchableMovie[]> {
    if (movieIds.length === 0) {
        return [];
    }

    const placeholders = movieIds.map(() => '?').join(',');
    const rows = await queryAll<SearchableMovie>(
        env,
        `SELECT
            m.*,
            ms.genres as search_genres,
            ms.cast_names,
            ms.crew_names,
            (
              SELECT group_concat(t.name_ar, ' | ')
              FROM movie_tags mt
              JOIN tags t ON t.id = mt.tag_id
              WHERE mt.movie_id = m.id
            ) as tag_names,
            (
              SELECT group_concat(c.name_ar, ' | ')
              FROM movie_companies mc
              JOIN companies c ON c.id = mc.company_id
              WHERE mc.movie_id = m.id
            ) as company_names
         FROM movies m
         LEFT JOIN movie_search ms ON ms.movie_id = m.id
         WHERE m.id IN (${placeholders})`,
        ...movieIds
    );

    return rows.map((movie) => {
        const sanitizedMovie = sanitizeMovie(movie);
        return {
            ...sanitizedMovie,
            search_document: buildSearchDocument(sanitizedMovie),
        };
    });
}

export async function listMoviesForVectorIndex(
    env: Env,
    limit: number,
    afterId?: string | null
): Promise<SearchableMovie[]> {
    const cursorClause = afterId ? 'AND m.id > ?' : '';
    const rows = await queryAll<SearchableMovie>(
        env,
        `SELECT
            m.*,
            ms.genres as search_genres,
            ms.cast_names,
            ms.crew_names,
            (
              SELECT group_concat(t.name_ar, ' | ')
              FROM movie_tags mt
              JOIN tags t ON t.id = mt.tag_id
              WHERE mt.movie_id = m.id
            ) as tag_names,
            (
              SELECT group_concat(c.name_ar, ' | ')
              FROM movie_companies mc
              JOIN companies c ON c.id = mc.company_id
              WHERE mc.movie_id = m.id
            ) as company_names
         FROM movies m
         LEFT JOIN movie_search ms ON ms.movie_id = m.id
         WHERE COALESCE(NULLIF(m.summary_ar, ''), NULLIF(m.story, '')) IS NOT NULL
         ${cursorClause}
         ORDER BY m.id ASC
         LIMIT ?`,
        ...(afterId ? [afterId] : []),
        limit
    );

    return rows.map((movie) => {
        const sanitizedMovie = sanitizeMovie(movie);
        return {
            ...sanitizedMovie,
            search_document: buildSearchDocument(sanitizedMovie),
        };
    });
}

export async function searchMoviesFullText(
    env: Env,
    query: string,
    limit: number = 20,
    yearMin?: number,
    yearMax?: number
): Promise<SearchableMovie[]> {
    if (!query || query.trim().length === 0) {
        return [];
    }

    const matchQuery = buildFtsMatchQuery(query);
    const { clause, params } = buildSearchFilterClause(yearMin, yearMax);

    const rows = await queryAll<SearchableMovie>(
        env,
        `SELECT
            m.*,
            ms.genres as search_genres,
            ms.cast_names,
            ms.crew_names,
            bm25(movie_search, 8.0, 10.0, 6.0, 4.0, 4.0, 2.2, 1.6, 1.6) as fts_rank
         FROM movie_search
         JOIN movies m ON m.id = movie_search.movie_id
         LEFT JOIN movie_search ms ON ms.movie_id = m.id
         WHERE movie_search MATCH ?${clause}
         ORDER BY fts_rank ASC, m.rating DESC, m.year DESC
         LIMIT ?`,
        matchQuery,
        ...params,
        limit
    );

    return rows.map((movie) => {
        const sanitizedMovie = sanitizeMovie(movie);
        return {
            ...sanitizedMovie,
            search_document: buildSearchDocument(sanitizedMovie),
        };
    });
}

async function searchMoviesLike(
    env: Env,
    query: string,
    limit: number = 20
): Promise<Movie[]> {
    const searchTerm = `%${query}%`;

    const rows = await queryAll<Movie>(
        env,
        `SELECT * FROM movies
        WHERE title LIKE ? OR title_ar LIKE ? OR title_en LIKE ? OR story LIKE ? OR summary_ar LIKE ?
        ORDER BY year DESC
        LIMIT ?`,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        limit
    );

    return rows.map((movie) => sanitizeMovie(movie));
}

/**
 * Get a single movie by ID (simplified for current schema)
 */
export async function getMovieBySlug(
    env: Env,
    idOrSlug: string
): Promise<MovieWithRelations | null> {
    const movie = await queryFirst<Movie>(
        env,
        'SELECT * FROM movies WHERE id = ? OR slug = ?',
        idOrSlug,
        idOrSlug
    );

    if (!movie) return null;

    const [watch_links, people, companies, genreRows, tags, assets, news] = await Promise.all([
        getWatchLinksForMovie(env, movie.id),
        getPeopleForMovie(env, movie.id),
        getCompaniesForMovie(env, movie.id),
        getGenresForMovie(env, movie.id),
        getTagsForMovie(env, movie.id),
        getAssetsForMovie(env, movie.id),
        getNewsForMovie(env, movie.id),
    ]);

    const sanitizedMovie = sanitizeMovie(movie);

    return {
        ...sanitizedMovie,
        genres: genreRows.length > 0
            ? genreRows.map(genre => genre.name_ar).join(',')
            : sanitizedMovie.genres,
        watch_links,
        people,
        companies,
        tags,
        assets,
        news,
    };
}

/**
 * Get watch links for a movie
 */
export async function getWatchLinksForMovie(
    env: Env,
    movieId: string
): Promise<WatchLink[]> {
    return queryAll<WatchLink>(
        env,
        'SELECT * FROM watch_links WHERE movie_id = ?',
        movieId
    );
}

/**
 * Get people credits for a movie
 */
export async function getPeopleForMovie(
    env: Env,
    movieId: string
): Promise<PersonCredit[]> {
    return queryAll<PersonCredit>(
        env,
        `SELECT 
      p.id, p.slug, p.name_ar, p.name_en, p.profile_image,
      mp.role_kind, mp.role_credit, mp.billing_order
    FROM movie_people mp
    JOIN people p ON p.id = mp.person_id
    WHERE mp.movie_id = ?
    ORDER BY 
      CASE mp.role_kind 
        WHEN 'director' THEN 1
        WHEN 'writer' THEN 2
        WHEN 'actor' THEN 3
        ELSE 4
      END,
      mp.billing_order,
      p.name_ar`,
        movieId
    );
}

/**
 * Get company credits for a movie
 */
export async function getCompaniesForMovie(
    env: Env,
    movieId: string
): Promise<CompanyCredit[]> {
    return queryAll<CompanyCredit>(
        env,
        `SELECT 
      c.id, c.slug, c.name_ar, c.name_en,
      mc.role_kind
    FROM movie_companies mc
    JOIN companies c ON c.id = mc.company_id
    WHERE mc.movie_id = ?
    ORDER BY mc.role_kind, c.name_ar`,
        movieId
    );
}

/**
 * Get genres for a movie
 */
export async function getGenresForMovie(
    env: Env,
    movieId: string
): Promise<Genre[]> {
    return queryAll<Genre>(
        env,
        `SELECT g.id, g.slug, g.name_ar, g.name_en
    FROM movie_genres mg
    JOIN genres g ON g.id = mg.genre_id
    WHERE mg.movie_id = ?
    ORDER BY g.name_ar`,
        movieId
    );
}

/**
 * Get tags for a movie
 */
export async function getTagsForMovie(
    env: Env,
    movieId: string
): Promise<Tag[]> {
    return queryAll<Tag>(
        env,
        `SELECT t.id, t.slug, t.name_ar, t.name_en, t.category
    FROM movie_tags mt
    JOIN tags t ON t.id = mt.tag_id
    WHERE mt.movie_id = ?
    ORDER BY t.category, t.name_ar`,
        movieId
    );
}

/**
 * Get assets for a movie
 */
export async function getAssetsForMovie(
    env: Env,
    movieId: string
): Promise<Asset[]> {
    return queryAll<Asset>(
        env,
        `SELECT id, kind, url, r2_key, width, height
    FROM assets
    WHERE movie_id = ?
    ORDER BY 
      CASE kind
        WHEN 'poster' THEN 1
        WHEN 'still' THEN 2
        WHEN 'frame' THEN 3
        ELSE 4
      END`,
        movieId
    );
}

/**
 * Get news and review links for a movie
 */
export interface MovieArticle {
    id: number;
    category: string;
    title: string | null;
    link: string | null;
    domain?: string | null;
    snippet: string | null;
    published_at?: string | null;
}

export interface MoviePremiere {
    id: string;
    slug: string | null;
    title_ar: string | null;
    title_en: string | null;
    title: string | null;
    year: number | null;
    release_date: string | null;
}

export async function getNewsForMovie(
    env: Env,
    movieId: string
): Promise<MovieArticle[]> {
    return queryAll<MovieArticle>(
        env,
        `SELECT id, category, title, link, domain, snippet, published_at
    FROM news
    WHERE entity_type = 'movie' AND entity_id = ?
    ORDER BY published_at DESC, id DESC`,
        movieId
    );
}

let supportsMovieReleaseDatePromise: Promise<boolean> | null = null;

async function supportsMovieReleaseDate(env: Env): Promise<boolean> {
    supportsMovieReleaseDatePromise ??= queryAll<{ name: string }>(
        env,
        'PRAGMA table_info(movies)'
    )
        .then((columns) => columns.some((column) => column.name === 'release_date'))
        .catch(() => false);

    return supportsMovieReleaseDatePromise;
}

export async function getMoviesReleasedOn(
    env: Env,
    month: number,
    day: number,
    limit: number = 20
): Promise<MoviePremiere[]> {
    if (!(await supportsMovieReleaseDate(env))) {
        return [];
    }

    const m = month.toString().padStart(2, '0');
    const d = day.toString().padStart(2, '0');

    return queryAll<MoviePremiere>(
        env,
        `SELECT id, slug, title_ar, title_en, title, year, release_date
         FROM movies
         WHERE release_date IS NOT NULL
           AND strftime('%m', release_date) = ?
           AND strftime('%d', release_date) = ?
         ORDER BY release_date DESC, year DESC
         LIMIT ?`,
        m,
        d,
        limit
    );
}

/**
 * List movies with filters and pagination
 */
export async function listMovies(
    env: Env,
    options: MovieListOptions = {}
): Promise<Movie[]> {
    const {
        filters = {},
        orderBy = 'year',
        direction = 'DESC',
        limit = 50,
        offset = 0,
    } = options;

    const { whereClause, params } = buildMovieFilters(filters);

    const query = `
    ${MOVIE_LIST_SELECT}
    ${whereClause}
    ORDER BY ${orderBy} ${direction}
    LIMIT ? OFFSET ?
  `;

    params.push(limit, offset);

    const rows = await queryAll<Movie>(env, query, ...params);
    return rows.map((movie) => sanitizeMovie(movie));
}

/**
 * Resolve a finite editorial movie list against archive movie rows.
 */
export async function getCuratedMovieList(
    env: Env,
    slug: string
): Promise<CuratedMovieList | null> {
    if (slug !== 'top-100-egyptian-movies') {
        return null;
    }

    const columns = await getMovieColumnNames(env);
    const column = (name: string, fallback = 'NULL') => columns.has(name) ? `m.${name}` : fallback;
    const titleMatchClause = columns.has('title') ? 'OR m.title = r.list_title_ar' : '';
    const lookupTitleMatchClause = columns.has('title') ? 'OR m.title = r.list_lookup_title_ar' : '';
    const valuesSql = TOP_100_EGYPTIAN_MOVIES.map((entry) => `(
        ${entry.rank},
        ${sqlString(entry.title_ar)},
        ${entry.year},
        ${sqlString(entry.director)},
        ${sqlString(entry.lookup_title_ar || '')}
    )`).join(', ');
    const rows = await queryAll<CuratedMovieListRow>(
        env,
        `WITH ranked(list_rank, list_title_ar, list_year, list_director, list_lookup_title_ar) AS (
            VALUES ${valuesSql}
        ),
        matches AS (
            SELECT
                r.list_rank,
                r.list_title_ar,
                r.list_year,
                r.list_director,
                r.list_lookup_title_ar,
                m.id,
                m.slug,
                ${column('title', 'm.title_ar')} as title,
                m.title_ar,
                m.title_en,
                m.year,
                ${column('work_type', column('type'))} as work_type,
                ${column('poster_url')} as poster_url,
                ${column('story')} as story,
                ${column('summary_ar')} as summary_ar,
                ${column('duration')} as duration,
                ${column('duration_minutes')} as duration_minutes,
                m.rating,
                ${column('genres')} as genres,
                ${column('country')} as country,
                ${column('language')} as language,
                ${column('release_date')} as release_date,
                ROW_NUMBER() OVER (
                    PARTITION BY r.list_rank
                    ORDER BY
                        CASE
                            WHEN m.id IS NULL THEN 2
                            WHEN m.year = r.list_year THEN 0
                            ELSE 1
                        END,
                        CASE
                            WHEN m.id IS NULL THEN 9999
                            ELSE ABS(COALESCE(m.year, 0) - r.list_year)
                        END,
                        m.year DESC
                ) as match_rank
            FROM ranked r
            LEFT JOIN movies m ON (
                m.title_ar = r.list_title_ar
                ${titleMatchClause}
                OR (
                    r.list_lookup_title_ar != ''
                    AND (
                        m.title_ar = r.list_lookup_title_ar
                        ${lookupTitleMatchClause}
                    )
                )
            )
        )
        SELECT *
        FROM matches
        WHERE match_rank = 1
        ORDER BY list_rank ASC`
    );

    const entries = rows.map((row) => ({
        rank: row.list_rank,
        title_ar: row.list_title_ar,
        year: row.list_year,
        director: row.list_director,
        lookup_title_ar: row.list_lookup_title_ar || undefined,
        movie: row.id ? sanitizeMovie(row) : null,
    }));

    return {
        slug: 'top-100-egyptian-movies',
        title_ar: 'أفضل 100 فيلم مصري',
        description_ar: 'قائمة مئوية السينما المصرية كما وردت في استفتاء النقاد عام 1996، مع ربط النتائج المتاحة بملصقات وصفحات ElFilm.',
        source_name: 'ويكيبيديا العربية',
        source_url: TOP_100_EGYPTIAN_MOVIES_SOURCE_URL,
        entries,
        count: entries.length,
        matched_count: entries.filter((entry) => entry.movie).length,
    };
}

/**
 * Count movies with the same filters used by listMovies.
 */
export async function countMovies(
    env: Env,
    filters: MovieFilters = {}
): Promise<number> {
    const { whereClause, params } = buildMovieFilters(filters);
    const result = await queryFirst<{ count: number }>(
        env,
        `SELECT COUNT(*) as count FROM movies${whereClause}`,
        ...params
    );
    return result?.count || 0;
}

/**
 * List all genres for browse filters.
 */
export async function listGenres(env: Env): Promise<Genre[]> {
    return queryAll<Genre>(
        env,
        `SELECT g.id, g.slug, g.name_ar, g.name_en, COUNT(mg.movie_id) as movie_count
         FROM genres g
         LEFT JOIN movie_genres mg ON mg.genre_id = g.id
         GROUP BY g.id
         ORDER BY g.id ASC`
    );
}

/**
 * Get movies by year
 */
export async function getMoviesByYear(
    env: Env,
    year: number,
    limit: number = 100
): Promise<Movie[]> {
    return listMovies(env, {
        filters: { year },
        orderBy: 'title',
        direction: 'ASC',
        limit,
    });
}

/**
 * Get movies by decade
 */
export async function getMoviesByDecade(
    env: Env,
    decade: number,
    limit: number = 100
): Promise<Movie[]> {
    return listMovies(env, {
        filters: { decade },
        orderBy: 'year',
        direction: 'ASC',
        limit,
    });
}

/**
 * Get related movies (same genre, director, or tags)
 */
export async function getRelatedMovies(
    env: Env,
    movieId: string,
    limit: number = 6
): Promise<Movie[]> {
    const rows = await queryAll<Movie>(
        env,
        `SELECT DISTINCT m.* FROM movies m
    WHERE m.id != ?
    AND (
      -- Same genres
      EXISTS (
        SELECT 1 FROM movie_genres mg1
        JOIN movie_genres mg2 ON mg1.genre_id = mg2.genre_id
        WHERE mg1.movie_id = ? AND mg2.movie_id = m.id
      )
      -- OR same director
      OR EXISTS (
        SELECT 1 FROM movie_people mp1
        JOIN movie_people mp2 ON mp1.person_id = mp2.person_id
        WHERE mp1.movie_id = ? 
        AND mp2.movie_id = m.id
        AND mp1.role_kind = 'director'
        AND mp2.role_kind = 'director'
      )
      -- OR same tags
      OR EXISTS (
        SELECT 1 FROM movie_tags mt1
        JOIN movie_tags mt2 ON mt1.tag_id = mt2.tag_id
        WHERE mt1.movie_id = ? AND mt2.movie_id = m.id
      )
    )
    ORDER BY m.year DESC, m.rating DESC
    LIMIT ?`,
        movieId, movieId, movieId, movieId, limit
    );

    return rows.map((movie) => sanitizeMovie(movie));
}

/**
 * Search movies using LIKE (simplified - no FTS)
 */
export async function searchMovies(
    env: Env,
    query: string,
    limit: number = 20
): Promise<Movie[]> {
    if (!query || query.trim().length === 0) {
        return [];
    }

    try {
        const rows = await searchMoviesFullText(env, query, limit);
        if (rows.length > 0) {
            return rows.map(({ search_document, search_genres, cast_names, crew_names, tag_names, company_names, fts_rank, ...movie }) => sanitizeMovie(movie));
        }
    } catch (error) {
        console.warn('FTS movie search unavailable, falling back to LIKE', error);
    }

    return searchMoviesLike(env, query, limit);
}
