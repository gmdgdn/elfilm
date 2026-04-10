/// <reference types="@cloudflare/workers-types" />

declare module "cloudflare:workers" {
  export const env: {
    DB: D1Database
    MEDIA: R2Bucket
    VECTORIZE: VectorizeIndex
    AI: Ai
    LOADER?: Fetcher
    ASSET_BASE_URL?: string
    ADMIN_API_KEY?: string
  }
}
