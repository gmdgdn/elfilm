/**
 * Hybrid search repository - Cloudflare Vectorize + Workers AI + D1 FTS
 */

import type { Env } from '../env';
import {
    getRelatedMovies,
    getSearchableMoviesByIds,
    searchMovies,
    searchMoviesFullText,
    type Movie,
    type SearchableMovie,
} from './movieRepo';

const EMBEDDING_MODEL = '@cf/baai/bge-m3';
const RERANK_MODEL = '@cf/baai/bge-reranker-base';
const RRF_K = 60;

// ============================================================
// TYPES
// ============================================================

export interface SemanticSearchOptions {
    query: string;
    limit?: number;
    yearMin?: number;
    yearMax?: number;
    genres?: string[];
    workType?: string;
}

export interface SemanticSearchResult extends Movie {
    similarity: number;
    source?: 'hybrid' | 'vector' | 'keyword';
}

interface CandidateScore {
    movie: SearchableMovie;
    vectorRank?: number;
    keywordRank?: number;
    rerankScore?: number;
}

interface RerankResponse {
    response?: Array<{
        id: number;
        score: number;
    }>;
}

interface SearchPlan {
    originalQuery: string;
    retrievalQuery: string;
    rankingQuery: string;
    yearMin?: number;
    yearMax?: number;
    workType?: string;
}

// ============================================================
// HELPERS
// ============================================================

function extractEmbedding(response: unknown): number[] {
    if (
        response &&
        typeof response === 'object' &&
        'data' in response &&
        Array.isArray((response as { data?: unknown }).data)
    ) {
        const data = (response as { data: unknown[] }).data[0];
        if (Array.isArray(data)) {
            return data as number[];
        }
    }

    throw new Error('Workers AI embedding response was missing vector data.');
}

function stripSearchFields(movie: SearchableMovie): Movie {
    const { search_document, search_genres, cast_names, crew_names, tag_names, company_names, fts_rank, ...base } =
        movie;
    return {
        ...base,
        summary_ar: typeof base.summary_ar === 'string'
            ? base.summary_ar.replace(/\s*(?:\.{3}|…)?\s*اقرأ المزيد\s*/g, ' ').replace(/\s{2,}/g, ' ').trim()
            : base.summary_ar,
        story: typeof base.story === 'string'
            ? base.story.replace(/\s*(?:\.{3}|…)?\s*اقرأ المزيد\s*/g, ' ').replace(/\s{2,}/g, ' ').trim()
            : base.story,
    };
}

function normalizeSearchText(value: string): string {
    return value
        .normalize('NFKC')
        .replace(/[\u064B-\u065F\u0670]/g, '')
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/[ؤ]/g, 'و')
        .replace(/[ئ]/g, 'ي')
        .replace(/[ى]/g, 'ي')
        .replace(/[ة]/g, 'ه')
        .replace(/ـ/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function buildSearchPlan(options: SemanticSearchOptions): SearchPlan {
    const originalQuery = options.query.trim();
    const normalizedOriginal = normalizeSearchText(originalQuery);
    const detectedYear = normalizedOriginal.match(/\b(18|19|20)\d{2}\b/)?.[0];
    const inferredYear =
        detectedYear && !options.yearMin && !options.yearMax ? Number.parseInt(detectedYear, 10) : undefined;

    const workTypeHints = [
        { pattern: /\b(فيلم|فلم|movie|film|cinema)\b/giu, value: 'فيلم' },
    ];

    let workType = options.workType;
    let strippedQuery = originalQuery;
    for (const hint of workTypeHints) {
        if (!workType && hint.pattern.test(originalQuery)) {
            workType = hint.value;
        }
        strippedQuery = strippedQuery.replace(hint.pattern, ' ');
    }

    const retrievalQuery = strippedQuery
        .replace(/\b(18|19|20)\d{2}\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return {
        originalQuery,
        retrievalQuery: retrievalQuery || originalQuery,
        rankingQuery: retrievalQuery || originalQuery,
        yearMin: options.yearMin ?? inferredYear,
        yearMax: options.yearMax ?? inferredYear,
        workType,
    };
}

function withinFilters(
    movie: SearchableMovie,
    options: Pick<SemanticSearchOptions, 'yearMin' | 'yearMax' | 'genres' | 'workType'>
): boolean {
    if (options.yearMin && Number(movie.year) < options.yearMin) {
        return false;
    }

    if (options.yearMax && Number(movie.year) > options.yearMax) {
        return false;
    }

    if (options.genres && options.genres.length > 0) {
        const haystack = `${movie.search_genres || movie.genres || ''}`.toLowerCase();
        if (!options.genres.some((genre) => haystack.includes(genre.toLowerCase()))) {
            return false;
        }
    }

    if (options.workType) {
        const movieType = String(movie.work_type || '').trim();
        if (movieType && movieType !== options.workType) {
            return false;
        }
    }

    return true;
}

function exactMatchBoost(query: string, movie: Pick<SearchableMovie, 'title_ar' | 'title' | 'title_en'>): number {
    const tier = titleMatchTier(query, movie);
    if (tier === 2) {
        return 0.08;
    }

    if (tier === 1) {
        return 0.04;
    }

    return 0;
}

function titleMatchTier(
    query: string,
    movie: Pick<SearchableMovie, 'title_ar' | 'title' | 'title_en'>
): number {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) {
        return 0;
    }

    const titles = [movie.title_ar, movie.title, movie.title_en]
        .filter(Boolean)
        .map((value) => normalizeSearchText(String(value)));

    if (titles.some((title) => title === normalizedQuery)) {
        return 2;
    }

    if (titles.some((title) => title.startsWith(normalizedQuery))) {
        return 1;
    }

    return 0;
}

function reciprocalRank(rank?: number): number {
    if (typeof rank !== 'number') {
        return 0;
    }

    return 1 / (RRF_K + rank + 1);
}

async function generateQueryEmbedding(env: Env, query: string): Promise<number[]> {
    const response = await env.AI.run(EMBEDDING_MODEL, {
        text: query,
    });

    return extractEmbedding(response);
}

function buildVectorFilter(
    options: Pick<SearchPlan, 'yearMin' | 'yearMax' | 'workType'>
): VectorizeVectorMetadataFilter | undefined {
    const filter: VectorizeVectorMetadataFilter = {};

    if (options.workType) {
        filter.work_type = options.workType;
    }

    if (options.yearMin || options.yearMax) {
        const yearRange: Record<string, number> = {};
        if (options.yearMin) {
            yearRange.$gte = options.yearMin;
        }
        if (options.yearMax) {
            yearRange.$lte = options.yearMax;
        }
        filter.year = yearRange;
    }

    return Object.keys(filter).length > 0 ? filter : undefined;
}

async function rerankCandidates(
    env: Env,
    query: string,
    candidates: CandidateScore[]
): Promise<Map<string, number>> {
    if (candidates.length === 0) {
        return new Map();
    }

    try {
        const response = (await env.AI.run(RERANK_MODEL, {
            query,
            top_k: candidates.length,
            contexts: candidates.map((candidate) => ({
                text:
                    candidate.movie.search_document ||
                    candidate.movie.summary_ar ||
                    candidate.movie.story ||
                    candidate.movie.title_ar ||
                    candidate.movie.title,
            })),
        })) as RerankResponse;

        const scores = new Map<string, number>();
        for (const item of response.response ?? []) {
            const target = candidates[item.id];
            if (target) {
                scores.set(target.movie.id, item.score);
            }
        }

        return scores;
    } catch (error) {
        console.warn('Workers AI reranker unavailable, continuing without rerank.', error);
        return new Map();
    }
}

async function getVectorCandidates(
    env: Env,
    query: string,
    limit: number,
    filter?: VectorizeVectorMetadataFilter
): Promise<SearchableMovie[]> {
    const queryVector = await generateQueryEmbedding(env, query);
    const vectorResults = await env.VECTORIZE.query(queryVector, {
        topK: limit,
        returnMetadata: 'none',
        filter,
    });

    if (!vectorResults.matches || vectorResults.matches.length === 0) {
        return [];
    }

    const movies = await getSearchableMoviesByIds(
        env,
        vectorResults.matches.map((match) => match.id)
    );
    const byId = new Map(movies.map((movie) => [movie.id, movie]));

    return vectorResults.matches
        .map((match) => byId.get(match.id))
        .filter(Boolean) as SearchableMovie[];
}

// ============================================================
// REPOSITORY FUNCTIONS
// ============================================================

/**
 * Semantic movie search using hybrid retrieval:
 * 1. D1 FTS gets lexical candidates
 * 2. Vectorize gets semantic candidates when vectors exist
 * 3. Workers AI reranker orders the merged set
 */
export async function semanticMovieSearch(
    env: Env,
    options: SemanticSearchOptions
): Promise<SemanticSearchResult[]> {
    if (!options.query || options.query.trim().length === 0) {
        return [];
    }

    const plan = buildSearchPlan(options);
    const { limit = 10, genres } = options;
    const candidateWindow = Math.min(Math.max(limit * 4, 24), 50);
    const candidateScores = new Map<string, CandidateScore>();

    const [keywordOutcome, vectorOutcome] = await Promise.allSettled([
        (async () => {
            try {
                return await searchMoviesFullText(
                    env,
                    plan.retrievalQuery,
                    candidateWindow,
                    plan.yearMin,
                    plan.yearMax
                );
            } catch (error) {
                console.warn('FTS candidate search failed, falling back to keyword LIKE.', error);
                const fallback = await searchMovies(env, plan.retrievalQuery, candidateWindow);
                return fallback.map((movie) => ({
                    ...movie,
                    search_document:
                        movie.summary_ar || movie.story || movie.title_ar || movie.title || movie.title_en || movie.id,
                }));
            }
        })(),
        getVectorCandidates(env, plan.retrievalQuery, candidateWindow, buildVectorFilter(plan)),
    ]);

    const keywordCandidates = keywordOutcome.status === 'fulfilled' ? keywordOutcome.value : [];
    if (keywordOutcome.status === 'rejected') {
        console.warn('Keyword candidate search failed.', keywordOutcome.reason);
    }

    keywordCandidates
        .filter((movie) =>
            withinFilters(movie, {
                yearMin: plan.yearMin,
                yearMax: plan.yearMax,
                genres,
                workType: plan.workType,
            })
        )
        .forEach((movie, index) => {
            candidateScores.set(movie.id, { movie, keywordRank: index });
        });

    if (vectorOutcome.status === 'fulfilled') {
        const vectorCandidates = vectorOutcome.value;
        vectorCandidates
            .filter((movie) =>
                withinFilters(movie, {
                    yearMin: plan.yearMin,
                    yearMax: plan.yearMax,
                    genres,
                    workType: plan.workType,
                })
            )
            .forEach((movie, index) => {
                const current = candidateScores.get(movie.id);
                candidateScores.set(movie.id, {
                    movie: current?.movie || movie,
                    keywordRank: current?.keywordRank,
                    vectorRank: index,
                });
            });
    } else {
        console.warn('Vector candidate search failed, returning keyword-only results.', vectorOutcome.reason);
    }

    const merged = Array.from(candidateScores.values())
        .map((candidate) => ({
            ...candidate,
            baseScore:
                reciprocalRank(candidate.vectorRank) * 0.58 +
                reciprocalRank(candidate.keywordRank) * 0.42 +
                exactMatchBoost(plan.rankingQuery, candidate.movie),
        }))
        .sort((left, right) => right.baseScore - left.baseScore)
        .slice(0, Math.max(limit * 2, 12));

    const hasExactTitleHit = merged.some((candidate) => titleMatchTier(plan.rankingQuery, candidate.movie) === 2);
    const shouldRerank =
        merged.length > 3 &&
        !hasExactTitleHit &&
        merged.some((candidate) => typeof candidate.vectorRank === 'number');
    const rerankScores = shouldRerank
        ? await rerankCandidates(env, plan.retrievalQuery, merged)
        : new Map<string, number>();

    return merged
        .map(({ movie, vectorRank, keywordRank, baseScore }) => {
            const rerankScore = rerankScores.get(movie.id);
            const combinedScore =
                typeof rerankScore === 'number'
                    ? rerankScore * 0.72 + baseScore * 0.28
                    : baseScore;

            return {
                ...stripSearchFields(movie),
                similarity: combinedScore,
                source:
                    typeof vectorRank === 'number' && typeof keywordRank === 'number'
                        ? 'hybrid'
                        : typeof vectorRank === 'number'
                            ? 'vector'
                            : 'keyword',
            } satisfies SemanticSearchResult;
        })
        .sort((left, right) => {
            const rightTier = titleMatchTier(plan.rankingQuery, right);
            const leftTier = titleMatchTier(plan.rankingQuery, left);
            if (rightTier !== leftTier) {
                return rightTier - leftTier;
            }

            return right.similarity - left.similarity;
        })
        .slice(0, limit);
}

/**
 * Find similar movies by vector proximity when available.
 */
export async function findSimilarMovies(
    env: Env,
    movieId: string,
    limit: number = 6
): Promise<SemanticSearchResult[]> {
    try {
        const vectors = await env.VECTORIZE.getByIds([movieId]);

        if (!vectors || vectors.length === 0) {
            return [];
        }

        const results = await env.VECTORIZE.query(vectors[0].values, {
            topK: limit + 1,
            returnMetadata: 'none',
        });

        const similarIds = results.matches
            .filter((match) => match.id !== movieId)
            .slice(0, limit)
            .map((match) => match.id);

        const movies = await getSearchableMoviesByIds(env, similarIds);
        const byId = new Map(movies.map((movie) => [movie.id, movie]));

        return results.matches
            .filter((match) => match.id !== movieId)
            .slice(0, limit)
            .map((match) => byId.get(match.id) ? {
                ...stripSearchFields(byId.get(match.id)!),
                similarity: match.score,
                source: 'vector' as const,
            } : null)
            .filter(Boolean) as SemanticSearchResult[];
    } catch (error) {
        console.warn('Similar-movie vector search failed.', error);
        const related = await getRelatedMovies(env, movieId, limit);
        return related.map((movie) => ({
            ...movie,
            similarity: 0,
            source: 'keyword',
        }));
    }
}

/**
 * Get embedding for text (useful for diagnostics)
 */
export async function getEmbedding(
    env: Env,
    text: string
): Promise<number[]> {
    return generateQueryEmbedding(env, text);
}
