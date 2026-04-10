/**
 * Environment bindings for Cloudflare Workers
 * Uses global types from @cloudflare/workers-types
 */
export interface Env {
    DB: D1Database;
    R2: R2Bucket;
    ASSETS?: Fetcher;
    VECTORIZE: VectorizeIndex;
    AI: Ai;
    ADMIN_API_KEY: string;
    TMDB_API_KEY?: string;
    TMDB_BEARER_TOKEN?: string;
    TMDB_ACCESS_TOKEN?: string;
    OMDB_API_KEY?: string;
    FANART_API_KEY?: string;
}

// Re-export D1Result for compatibility - use native D1Response
export type D1Result<T = unknown> = {
    results?: T[];
    success: boolean;
    error?: string;
    meta: D1Meta;
};
