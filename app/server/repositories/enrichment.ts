import type { Env } from '../env';
import { execute, queryAll, queryFirst } from '../db';

type Primitive = string | number | boolean | null | undefined;

interface MovieRecord {
    id: string;
    slug: string | null;
    title: string | null;
    title_ar: string | null;
    title_en: string | null;
    year: number | null;
    summary_ar: string | null;
    story: string | null;
    poster_url: string | null;
    release_date: string | null;
    duration_minutes: number | null;
    rating: number | string | null;
    country: string | null;
    language: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    tmdb_id?: string | null;
    tmdb_movie_id?: string | null;
    imdb_id?: string | null;
}

interface PersonRecord {
    id: string;
    slug: string | null;
    name_ar: string | null;
    name_en: string | null;
    bio_ar: string | null;
    bio: string | null;
    created_at?: string | null;
    tmdb_id?: string | null;
    tmdb_person_id?: string | null;
    imdb_id?: string | null;
}

interface TmdbSearchResult {
    id: number;
    title?: string;
    original_title?: string;
    overview?: string;
    release_date?: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
    vote_average?: number;
    runtime?: number | null;
    imdb_id?: string | null;
    original_language?: string;
    year?: string;
}

interface TmdbMovieDetails extends TmdbSearchResult {
    genres?: Array<{ id?: number; name?: string }>;
    production_countries?: Array<{ iso_3166_1?: string; name?: string }>;
    spoken_languages?: Array<{ iso_639_1?: string; name?: string }>;
    external_ids?: {
        imdb_id?: string | null;
        wikidata_id?: string | null;
    };
}

interface WikidataBinding {
    type?: string;
    value?: string;
}

interface WikidataResponse {
    results?: {
        bindings?: Array<{
            item?: WikidataBinding;
            itemLabel?: WikidataBinding;
        }>;
    };
}

export interface SearchCorpusGenerationSummary {
    movieCount: number;
    peopleCount: number;
    uploaded: number;
}

export interface MovieEnrichmentResult {
    found: boolean;
    movieId: string;
    updated: boolean;
    appliedFields: string[];
    skippedReason?: string;
    metadata?: {
        tmdbId: number;
        imdbId: string | null;
        titleAr: string | null;
        titleEn: string | null;
        summaryAr: string | null;
        releaseDate: string | null;
        posterUrl: string | null;
        backdropUrl: string | null;
        runtime: number | null;
        rating: number | null;
        productionCountries: string[];
        spokenLanguages: string[];
    };
}

export interface PersonEnrichmentResult {
    found: boolean;
    personId: string;
    updated: boolean;
    wikidataId: string | null;
    tmdbPersonId: string | null;
    arabicName: string | null;
    skippedReason?: string;
}

export interface GeneratedTagResult {
    tags: string[];
    persisted: boolean;
    movieId?: string;
}

const TMDB_API_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const WIKIDATA_SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const OMDB_API_BASE = 'https://www.omdbapi.com/';
const FANART_API_BASE = 'https://webservice.fanart.tv/v3/movies';

const columnCache = new Map<string, Set<string>>();

function normalizeText(value: Primitive): string {
    return typeof value === 'string' ? value.trim() : '';
}

function isArabicText(value: string | null | undefined): boolean {
    return Boolean(value && /[\u0600-\u06FF]/.test(value));
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeSparqlString(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function slugifyTag(value: string): string {
    const normalized = value
        .normalize('NFKD')
        .replace(/[\u064B-\u065F\u0670]/g, '')
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-')
        .toLowerCase();

    return normalized || 'tag';
}

function uniqueStrings(values: string[]): string[] {
    return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function extractFirstText(value: unknown): string {
    if (typeof value === 'string') {
        return value.trim();
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            const text = extractFirstText(item);
            if (text) {
                return text;
            }
        }
    }

    if (value && typeof value === 'object' && 'url' in value) {
        const candidate = (value as { url?: unknown }).url;
        if (typeof candidate === 'string') {
            return candidate.trim();
        }
    }

    return '';
}

async function getTableColumns(env: Env, table: string): Promise<Set<string>> {
    const cached = columnCache.get(table);
    if (cached) {
        return cached;
    }

    const rows = await queryAll<{ name: string }>(env, `PRAGMA table_info(${table})`);
    const columns = new Set(rows.map((row) => row.name));
    columnCache.set(table, columns);
    return columns;
}

async function hasColumn(env: Env, table: string, column: string): Promise<boolean> {
    const columns = await getTableColumns(env, table);
    return columns.has(column);
}

function createHtmlDocument(title: string, bodyLines: string[]): string {
    const body = bodyLines
        .filter(Boolean)
        .map((line) => `<p>${escapeHtml(line)}</p>`)
        .join('');

    return `<!doctype html><html lang="ar"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body><main data-pagefind-body><article><h1>${escapeHtml(title)}</h1>${body}</article></main></body></html>`;
}

function buildMovieCorpusHtml(movie: {
    title_ar: string | null;
    title_en: string | null;
    year: number | null;
    summary_ar: string | null;
    story: string | null;
    release_date?: string | null;
}): string {
    const title = movie.title_ar || movie.title_en || 'Untitled movie';
    const bodyLines = [
        movie.title_en ? `English title: ${movie.title_en}` : '',
        movie.year ? `Year: ${movie.year}` : '',
        movie.release_date ? `Release date: ${movie.release_date}` : '',
        movie.summary_ar || movie.story || '',
    ];

    return createHtmlDocument(title, bodyLines);
}

function buildPersonCorpusHtml(person: {
    name_ar: string | null;
    name_en: string | null;
    bio_ar: string | null;
    bio: string | null;
    created_at?: string | null;
}): string {
    const title = person.name_ar || person.name_en || 'Untitled person';
    const bodyLines = [
        person.name_en ? `English name: ${person.name_en}` : '',
        person.bio_ar || person.bio || '',
        person.created_at ? `Updated: ${person.created_at}` : '',
    ];

    return createHtmlDocument(title, bodyLines);
}

function getTmdbCredentials(env: Env): { apiKey?: string; bearerToken?: string } | null {
    const apiKey = normalizeText(env.TMDB_API_KEY);
    const bearerToken = normalizeText(env.TMDB_BEARER_TOKEN || env.TMDB_ACCESS_TOKEN);

    if (!apiKey && !bearerToken) {
        return null;
    }

    return {
        apiKey: apiKey || undefined,
        bearerToken: bearerToken || undefined,
    };
}

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T | null> {
    const response = await fetch(input, init);
    if (!response.ok) {
        return null;
    }

    try {
        return (await response.json()) as T;
    } catch {
        return null;
    }
}

function buildTmdbUrl(
    path: string,
    params: Record<string, string | number | undefined>,
    apiKey?: string
): string {
    const url = new URL(`${TMDB_API_BASE}${path}`);
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== '') {
            url.searchParams.set(key, String(value));
        }
    }

    if (apiKey) {
        url.searchParams.set('api_key', apiKey);
    }

    return url.toString();
}

function getTmdbHeaders(env: Env): HeadersInit {
    const credentials = getTmdbCredentials(env);
    if (credentials?.bearerToken) {
        return {
            Authorization: `Bearer ${credentials.bearerToken}`,
            Accept: 'application/json',
        };
    }

    return {
        Accept: 'application/json',
    };
}

async function fetchTmdbDetailsById(
    env: Env,
    tmdbId: number
): Promise<TmdbMovieDetails | null> {
    const credentials = getTmdbCredentials(env);
    if (!credentials) {
        return null;
    }

    const url = buildTmdbUrl(
        `/movie/${tmdbId}`,
        {
            language: 'ar-EG',
            append_to_response: 'external_ids',
        },
        credentials.apiKey
    );

    return fetchJson<TmdbMovieDetails>(url, {
        headers: getTmdbHeaders(env),
    });
}

async function searchTmdbMovie(
    env: Env,
    movie: MovieRecord
): Promise<TmdbSearchResult | null> {
    const credentials = getTmdbCredentials(env);
    if (!credentials) {
        return null;
    }

    const query = movie.title_ar || movie.title || movie.title_en;
    if (!query) {
        return null;
    }

    const url = buildTmdbUrl(
        '/search/movie',
        {
            language: 'ar-EG',
            query,
            year: movie.year ?? undefined,
            include_adult: 'false',
        },
        credentials.apiKey
    );

    const payload = await fetchJson<{ results?: TmdbSearchResult[] }>(url, {
        headers: getTmdbHeaders(env),
    });

    if (!payload?.results?.length) {
        return null;
    }

    const normalizedYear = movie.year ? String(movie.year) : null;
    const matchingYear = payload.results.find((candidate) => candidate.release_date?.startsWith(normalizedYear || ''));
    return matchingYear || payload.results[0] || null;
}

async function fetchOmdbPoster(env: Env, imdbId: string): Promise<{ posterUrl: string | null }> {
    const apiKey = normalizeText(env.OMDB_API_KEY);
    if (!apiKey) {
        return { posterUrl: null };
    }

    const url = new URL(OMDB_API_BASE);
    url.searchParams.set('i', imdbId);
    url.searchParams.set('plot', 'short');
    url.searchParams.set('apikey', apiKey);

    const payload = await fetchJson<{ Poster?: string }>(url.toString());
    const posterUrl = payload?.Poster && payload.Poster !== 'N/A' ? payload.Poster : null;

    return { posterUrl };
}

async function fetchFanartBackdrop(env: Env, imdbId: string): Promise<{ backdropUrl: string | null }> {
    const apiKey = normalizeText(env.FANART_API_KEY);
    if (!apiKey) {
        return { backdropUrl: null };
    }

    const url = new URL(`${FANART_API_BASE}/${encodeURIComponent(imdbId)}`);
    url.searchParams.set('api_key', apiKey);

    const payload = await fetchJson<Record<string, unknown>>(url.toString());
    if (!payload) {
        return { backdropUrl: null };
    }

    const backdropUrl =
        extractFirstText((payload as { moviebackground?: unknown }).moviebackground) ||
        extractFirstText((payload as { movieart?: unknown }).movieart) ||
        extractFirstText((payload as { movieposter?: unknown }).movieposter);

    return { backdropUrl: backdropUrl || null };
}

async function resolveFallbackImages(
    env: Env,
    imdbId: string | null,
    posterPath: string | null,
    backdropPath: string | null
): Promise<{ posterUrl: string | null; backdropUrl: string | null }> {
    const posterUrl = posterPath
        ? `${TMDB_IMAGE_BASE}/w780${posterPath}`
        : null;
    const backdropUrl = backdropPath
        ? `${TMDB_IMAGE_BASE}/w1280${backdropPath}`
        : null;

    if ((!posterUrl || !backdropUrl) && imdbId) {
        const [omdb, fanart] = await Promise.all([
            posterUrl ? Promise.resolve({ posterUrl: null }) : fetchOmdbPoster(env, imdbId),
            backdropUrl ? Promise.resolve({ backdropUrl: null }) : fetchFanartBackdrop(env, imdbId),
        ]);

        return {
            posterUrl: posterUrl || omdb.posterUrl || null,
            backdropUrl: backdropUrl || fanart.backdropUrl || null,
        };
    }

    return { posterUrl, backdropUrl };
}

async function loadMovie(env: Env, idOrSlug: string): Promise<MovieRecord | null> {
    return queryFirst<MovieRecord>(env, 'SELECT * FROM movies WHERE id = ? OR slug = ?', idOrSlug, idOrSlug);
}

async function loadPerson(env: Env, idOrSlug: string): Promise<PersonRecord | null> {
    return queryFirst<PersonRecord>(env, 'SELECT * FROM people WHERE id = ? OR slug = ?', idOrSlug, idOrSlug);
}

async function updateMovieColumns(
    env: Env,
    movieId: string,
    updates: Record<string, Primitive>
): Promise<string[]> {
    const applied = Object.entries(updates).filter(([, value]) => value !== undefined && value !== null && value !== '');
    if (applied.length === 0) {
        return [];
    }

    const columns = await getTableColumns(env, 'movies');
    const filtered = applied.filter(([column]) => columns.has(column));
    if (filtered.length === 0) {
        return [];
    }

    const setClause = filtered.map(([column]) => `${column} = ?`).join(', ');
    const values = filtered.map(([, value]) => value);
    await execute(env, `UPDATE movies SET ${setClause} WHERE id = ?`, ...values, movieId);
    return filtered.map(([column]) => column);
}

async function updatePersonColumns(
    env: Env,
    personId: string,
    updates: Record<string, Primitive>
): Promise<string[]> {
    const applied = Object.entries(updates).filter(([, value]) => value !== undefined && value !== null && value !== '');
    if (applied.length === 0) {
        return [];
    }

    const columns = await getTableColumns(env, 'people');
    const filtered = applied.filter(([column]) => columns.has(column));
    if (filtered.length === 0) {
        return [];
    }

    const setClause = filtered.map(([column]) => `${column} = ?`).join(', ');
    const values = filtered.map(([, value]) => value);
    await execute(env, `UPDATE people SET ${setClause} WHERE id = ?`, ...values, personId);
    return filtered.map(([column]) => column);
}

async function updateOrInsertTag(
    env: Env,
    tag: string
): Promise<number | null> {
    const slug = `ai-${slugifyTag(tag)}`;
    const existing = await queryFirst<{ id: number }>(env, 'SELECT id FROM tags WHERE slug = ?', slug);
    if (existing?.id) {
        return existing.id;
    }

    const result = await execute(
        env,
        'INSERT OR IGNORE INTO tags (slug, name_ar, name_en, category) VALUES (?, ?, ?, ?)',
        slug,
        tag,
        null,
        'ai'
    );

    const insertedId = typeof result.meta?.last_row_id === 'number'
        ? result.meta.last_row_id
        : Number(result.meta?.last_row_id || 0);

    if (insertedId > 0) {
        return insertedId;
    }

    const inserted = await queryFirst<{ id: number }>(env, 'SELECT id FROM tags WHERE slug = ?', slug);
    return inserted?.id ?? null;
}

function buildFallbackTags(synopsis: string): string[] {
    const words = synopsis
        .split(/[\s،؛,.!?()\[\]{}]+/g)
        .map((word) => word.trim())
        .filter((word) => word.length >= 3 && /[\u0600-\u06FF]/.test(word));

    const fallback = uniqueStrings(words).slice(0, 5);
    if (fallback.length >= 5) {
        return fallback.slice(0, 5);
    }

    return uniqueStrings([
        ...fallback,
        'دراما',
        'سينما',
        'عائلة',
        'صراع',
        'هوية',
    ]).slice(0, 5);
}

function normalizeGeneratedTags(tags: string[]): string[] {
    const cleaned = uniqueStrings(
        tags
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0)
    );
    return cleaned.slice(0, 5);
}

export async function generateSearchCorpus(env: Env): Promise<SearchCorpusGenerationSummary> {
    const [movieCountRow, peopleCountRow] = await Promise.all([
        queryFirst<{ count: number }>(env, 'SELECT COUNT(*) as count FROM movies'),
        queryFirst<{ count: number }>(env, 'SELECT COUNT(*) as count FROM people'),
    ]);

    const movieCount = movieCountRow?.count ?? 0;
    const peopleCount = peopleCountRow?.count ?? 0;
    const batchSize = 250;
    let uploaded = 0;

    for (let offset = 0; offset < movieCount; offset += batchSize) {
        const movies = await queryAll<MovieRecord>(
            env,
            `SELECT id, slug, title, title_ar, title_en, year, summary_ar, story, poster_url, release_date, created_at, updated_at
             FROM movies
             ORDER BY id
             LIMIT ? OFFSET ?`,
            batchSize,
            offset
        );

        const writes = movies.map(async (movie) => {
            const key = `search-corpus/movies/${movie.id}.html`;
            const html = buildMovieCorpusHtml(movie);
            try {
                await env.R2.put(key, html, {
                    httpMetadata: {
                        contentType: 'text/html; charset=utf-8',
                    },
                });
                uploaded += 1;
            } catch (error) {
                console.error(`Failed to write movie corpus entry ${movie.id}`, error);
            }
        });

        await Promise.all(writes);
    }

    for (let offset = 0; offset < peopleCount; offset += batchSize) {
        const people = await queryAll<PersonRecord>(
            env,
            `SELECT id, slug, name_ar, name_en, bio_ar, bio, created_at
             FROM people
             ORDER BY id
             LIMIT ? OFFSET ?`,
            batchSize,
            offset
        );

        const writes = people.map(async (person) => {
            const key = `search-corpus/people/${person.id}.html`;
            const html = buildPersonCorpusHtml(person);
            try {
                await env.R2.put(key, html, {
                    httpMetadata: {
                        contentType: 'text/html; charset=utf-8',
                    },
                });
                uploaded += 1;
            } catch (error) {
                console.error(`Failed to write person corpus entry ${person.id}`, error);
            }
        });

        await Promise.all(writes);
    }

    return {
        movieCount,
        peopleCount,
        uploaded,
    };
}

export async function fetchTmdbMovieMetadata(
    env: Env,
    movieIdOrSlug: string
): Promise<{
    movie: MovieRecord;
        metadata: {
            tmdbId: number;
            imdbId: string | null;
            titleAr: string | null;
            titleEn: string | null;
            summaryAr: string | null;
            releaseDate: string | null;
            posterUrl: string | null;
            backdropUrl: string | null;
            runtime: number | null;
            rating: number | null;
            productionCountries: string[];
            spokenLanguages: string[];
        };
} | null> {
    const movie = await loadMovie(env, movieIdOrSlug);
    if (!movie) {
        return null;
    }

    const credentials = getTmdbCredentials(env);
    if (!credentials) {
        return null;
    }

    const tmdbIdFromRow = normalizeText(movie.tmdb_movie_id || movie.tmdb_id);
    let tmdbDetails: TmdbMovieDetails | null = null;

    if (tmdbIdFromRow && /^\d+$/.test(tmdbIdFromRow)) {
        tmdbDetails = await fetchTmdbDetailsById(env, Number(tmdbIdFromRow));
    } else {
        const searchResult = await searchTmdbMovie(env, movie);
        if (searchResult?.id) {
            tmdbDetails = await fetchTmdbDetailsById(env, searchResult.id);
        }
    }

    if (!tmdbDetails) {
        return null;
    }

    const imdbId = normalizeText(tmdbDetails.external_ids?.imdb_id || tmdbDetails.imdb_id || movie.imdb_id) || null;
    const posterFallbacks = await resolveFallbackImages(
        env,
        imdbId,
        tmdbDetails.poster_path || null,
        tmdbDetails.backdrop_path || null
    );

    const titleAr = isArabicText(tmdbDetails.title || '')
        ? normalizeText(tmdbDetails.title)
        : (movie.title_ar || normalizeText(tmdbDetails.title) || null);
    const titleEn = normalizeText(tmdbDetails.original_title || tmdbDetails.title || movie.title_en) || null;
    const summaryAr = isArabicText(tmdbDetails.overview || '')
        ? normalizeText(tmdbDetails.overview)
        : (movie.summary_ar || normalizeText(tmdbDetails.overview) || null);

    return {
        movie,
        metadata: {
            tmdbId: tmdbDetails.id,
            imdbId,
            titleAr,
            titleEn,
            summaryAr,
            releaseDate: normalizeText(tmdbDetails.release_date) || null,
            posterUrl: posterFallbacks.posterUrl,
            backdropUrl: posterFallbacks.backdropUrl,
            runtime: typeof tmdbDetails.runtime === 'number' ? tmdbDetails.runtime : null,
            rating: typeof tmdbDetails.vote_average === 'number' ? tmdbDetails.vote_average : null,
            productionCountries: (tmdbDetails.production_countries || [])
                .map((country) => country.name || '')
                .filter(Boolean),
            spokenLanguages: (tmdbDetails.spoken_languages || [])
                .map((language) => language.name || '')
                .filter(Boolean),
        },
    };
}

export async function enrichMovieById(
    env: Env,
    movieIdOrSlug: string
): Promise<MovieEnrichmentResult> {
    const movie = await loadMovie(env, movieIdOrSlug);
    if (!movie) {
        return {
            found: false,
            movieId: movieIdOrSlug,
            updated: false,
            appliedFields: [],
        };
    }

    const credentials = getTmdbCredentials(env);
    if (!credentials) {
        return {
            found: true,
            movieId: movie.id,
            updated: false,
            appliedFields: [],
            skippedReason: 'missing_tmdb_credentials',
        };
    }

    const lookup = await fetchTmdbMovieMetadata(env, movieIdOrSlug);
    if (!lookup) {
        return {
            found: true,
            movieId: movie.id,
            updated: false,
            appliedFields: [],
            skippedReason: 'tmdb_lookup_unavailable',
        };
    }

    const { metadata } = lookup;
    const updates: Record<string, Primitive> = {};
    const columns = await getTableColumns(env, 'movies');

    if (columns.has('tmdb_id')) {
        updates.tmdb_id = String(metadata.tmdbId);
    }
    if (columns.has('imdb_id') && metadata.imdbId) {
        updates.imdb_id = metadata.imdbId;
    }
    if (columns.has('title_ar') && metadata.titleAr) {
        updates.title_ar = metadata.titleAr;
    }
    if (columns.has('title_en') && metadata.titleEn) {
        updates.title_en = metadata.titleEn;
    }
    if (columns.has('summary_ar') && metadata.summaryAr) {
        updates.summary_ar = metadata.summaryAr;
    }
    if (columns.has('release_date') && metadata.releaseDate) {
        updates.release_date = metadata.releaseDate;
    }
    if (columns.has('poster_url') && metadata.posterUrl) {
        updates.poster_url = metadata.posterUrl;
    }
    if (columns.has('duration_minutes') && metadata.runtime) {
        updates.duration_minutes = metadata.runtime;
    }
    if (columns.has('rating') && metadata.rating !== null) {
        updates.rating = metadata.rating;
    }
    if (columns.has('country') && !movie.country && metadata.productionCountries.length > 0) {
        updates.country = metadata.productionCountries[0];
    }
    if (columns.has('language') && !movie.language && metadata.spokenLanguages.length > 0) {
        updates.language = metadata.spokenLanguages[0];
    }
    if (columns.has('updated_at')) {
        updates.updated_at = new Date().toISOString();
    }

    const appliedFields = await updateMovieColumns(env, movie.id, updates);
    return {
        found: true,
        movieId: movie.id,
        updated: appliedFields.length > 0,
        appliedFields,
        metadata: {
            tmdbId: metadata.tmdbId,
            imdbId: metadata.imdbId,
            titleAr: metadata.titleAr,
            titleEn: metadata.titleEn,
            summaryAr: metadata.summaryAr,
            releaseDate: metadata.releaseDate,
            posterUrl: metadata.posterUrl,
            backdropUrl: metadata.backdropUrl,
            runtime: metadata.runtime,
            rating: metadata.rating,
            productionCountries: metadata.productionCountries,
            spokenLanguages: metadata.spokenLanguages,
        },
    };
}

export async function lookupWikidataArabicLabelByTmdbPersonId(
    env: Env,
    personIdOrSlug: string
): Promise<{
    person: PersonRecord;
    tmdbPersonId: string;
    wikidataId: string | null;
    arabicLabel: string | null;
} | null> {
    const person = await loadPerson(env, personIdOrSlug);
    if (!person) {
        return null;
    }

    const tmdbPersonId = normalizeText(person.tmdb_person_id || person.tmdb_id);
    if (!tmdbPersonId) {
        return {
            person,
            tmdbPersonId: '',
            wikidataId: null,
            arabicLabel: null,
        };
    }

    const sparql = `
        SELECT ?item ?itemLabel WHERE {
          ?item wdt:P31 wd:Q5.
          ?item wdt:P4985 "${escapeSparqlString(tmdbPersonId)}".
          ?item rdfs:label ?itemLabel.
          FILTER(LANG(?itemLabel) = "ar")
        }
        LIMIT 1
    `.trim();

    const url = new URL(WIKIDATA_SPARQL_ENDPOINT);
    url.searchParams.set('format', 'json');
    url.searchParams.set('query', sparql);

    const payload = await fetchJson<WikidataResponse>(url.toString(), {
        headers: {
            Accept: 'application/sparql-results+json',
            'User-Agent': 'ElFilm/1.0 (Cloudflare Workers)',
        },
    });

    const binding = payload?.results?.bindings?.[0];
    const wikidataId = binding?.item?.value || null;
    const arabicLabel = binding?.itemLabel?.value?.trim() || null;

    return {
        person,
        tmdbPersonId,
        wikidataId,
        arabicLabel,
    };
}

export async function enrichPersonArabicNameById(
    env: Env,
    personIdOrSlug: string
): Promise<PersonEnrichmentResult> {
    const lookup = await lookupWikidataArabicLabelByTmdbPersonId(env, personIdOrSlug);
    if (!lookup) {
        return {
            found: false,
            personId: personIdOrSlug,
            updated: false,
            wikidataId: null,
            tmdbPersonId: null,
            arabicName: null,
        };
    }

    if (!lookup.arabicLabel) {
        return {
            found: true,
            personId: lookup.person.id,
            updated: false,
            wikidataId: lookup.wikidataId,
            tmdbPersonId: lookup.tmdbPersonId || null,
            arabicName: null,
            skippedReason: lookup.tmdbPersonId
                ? 'wikidata_label_unavailable'
                : 'missing_tmdb_person_id',
        };
    }

    const appliedFields = await updatePersonColumns(env, lookup.person.id, {
        name_ar: lookup.arabicLabel,
    });

    return {
        found: true,
        personId: lookup.person.id,
        updated: appliedFields.length > 0,
        wikidataId: lookup.wikidataId,
        tmdbPersonId: lookup.tmdbPersonId || null,
        arabicName: lookup.arabicLabel,
    };
}

async function runAiTagger(env: Env, synopsis: string): Promise<string[] | null> {
    if (!env.AI || typeof env.AI.run !== 'function') {
        return null;
    }

    const prompt = [
        'You are an expert cinematic taxonomist specializing in Egyptian film.',
        'Read the synopsis and output a JSON array containing exactly 5 highly relevant thematic tags in Arabic.',
        'Do not output markdown, commentary, or any text outside the raw JSON array.',
        'Return only the array.',
    ].join(' ');

    const ai = env.AI as {
        run(model: string, input: unknown): Promise<{ response?: string } | string>;
    };

    const result = await ai.run('@cf/google/gemma-4-26b-a4b-it', {
        messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: synopsis },
        ],
        temperature: 0.2,
        max_tokens: 160,
        top_p: 0.9,
    });

    const responseText = typeof result === 'string'
        ? result
        : (result && typeof result === 'object' && 'response' in result && typeof result.response === 'string'
            ? result.response
            : '');

    const cleaned = responseText
        .trim()
        .replace(/^```(?:json)?/i, '')
        .replace(/```$/i, '')
        .trim();

    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    const payloadText = arrayMatch ? arrayMatch[0] : cleaned;
    const parsed = JSON.parse(payloadText) as unknown;
    if (!Array.isArray(parsed)) {
        return null;
    }

    const tags = parsed
        .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
        .filter(Boolean);

    return normalizeGeneratedTags(tags);
}

export async function generateMovieTags(
    env: Env,
    synopsis: string
): Promise<string[]> {
    const cleanedSynopsis = normalizeText(synopsis);
    if (!cleanedSynopsis) {
        return [];
    }

    try {
        const aiTags = await runAiTagger(env, cleanedSynopsis);
        if (aiTags && aiTags.length > 0) {
            return aiTags.length >= 5 ? aiTags.slice(0, 5) : uniqueStrings([...aiTags, ...buildFallbackTags(cleanedSynopsis)]).slice(0, 5);
        }
    } catch (error) {
        console.warn('Workers AI tag generation failed, falling back to heuristic tags.', error);
    }

    return buildFallbackTags(cleanedSynopsis);
}

export async function persistGeneratedMovieTags(
    env: Env,
    movieId: string,
    tags: string[]
): Promise<GeneratedTagResult> {
    const normalizedTags = normalizeGeneratedTags(tags);
    if (normalizedTags.length === 0) {
        return {
            tags: [],
            persisted: false,
            movieId,
        };
    }

    const columns = await getTableColumns(env, 'movie_tags');
    if (!columns.has('movie_id') || !columns.has('tag_id')) {
        return {
            tags: normalizedTags,
            persisted: false,
            movieId,
        };
    }

    for (const tag of normalizedTags) {
        const tagId = await updateOrInsertTag(env, tag);
        if (!tagId) {
            continue;
        }

        await execute(
            env,
            'INSERT OR IGNORE INTO movie_tags (movie_id, tag_id) VALUES (?, ?)',
            movieId,
            tagId
        );
    }

    return {
        tags: normalizedTags,
        persisted: true,
        movieId,
    };
}
