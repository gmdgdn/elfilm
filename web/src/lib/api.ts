// API configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://elfilm.anagmdgdn.workers.dev'
const ASSET_BASE_URL = process.env.NEXT_PUBLIC_ASSET_URL || 'https://film.gmd.gdn'

function rewritePublicAssetUrl(value: string): string {
    if (value.startsWith("http://") || value.startsWith("https://")) {
        try {
            const url = new URL(value)
            if (url.pathname.startsWith("/assets/elfilm/")) {
                return `${ASSET_BASE_URL}${url.pathname}${url.search}${url.hash}`
            }
            if (url.hostname === "elfilm.net" && url.pathname.startsWith("/assets/")) {
                return `${ASSET_BASE_URL}${url.pathname}${url.search}${url.hash}`
            }
        } catch {
            // Fall through to legacy string rewrite below.
        }
    }

    if (value.startsWith("/assets/elfilm/")) {
        return `${ASSET_BASE_URL}${value}`
    }

    return value.replace(/^https:\/\/elfilm\.net\/assets\//, `${ASSET_BASE_URL}/assets/`)
}

function rewritePublicAssetUrls<T>(value: T): T {
    if (typeof value === "string") {
        return rewritePublicAssetUrl(value) as T
    }

    if (Array.isArray(value)) {
        return value.map((item) => rewritePublicAssetUrls(item)) as T
    }

    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [key, rewritePublicAssetUrls(item)])
        ) as T
    }

    return value
}

async function fetchJson<T>(url: string, errorMessage: string): Promise<T> {
    try {
        const res = await fetch(url)
        if (!res.ok) {
            const body = await res.text().catch(() => "")
            console.error("ElFilm API request failed", {
                url,
                status: res.status,
                body: body.slice(0, 500),
            })
            throw new Error(`${errorMessage}: ${res.status}`)
        }
        return rewritePublicAssetUrls(await res.json() as T)
    } catch (error) {
        console.error("ElFilm API request errored", {
            url,
            message: error instanceof Error ? error.message : String(error),
        })
        throw error
    }
}

// Types - Simplified to match current backend schema
export interface Movie {
    id: string
    title: string  // Arabic title (current schema)
    title_ar?: string  // Alias for compatibility
    title_en?: string | null
    year: number | string
    poster_url?: string | null
    story?: string | null
    duration?: string | null
    rating?: string | null
    genres?: string | null
    // Legacy fields (may not be present)
    slug?: string
    summary_ar?: string | null
    duration_minutes?: number | null
    type?: string | null
    country?: string
    language?: string
}

export interface MovieWithRelations extends Movie {
    cast?: CreditEntry[]
    crew?: CreditEntry[]
    watch_links?: WatchLink[]
    news?: MovieArticle[]
    // Legacy relation fields
    people?: PersonCredit[]
    companies?: CompanyCredit[]
    tags?: Tag[]
    assets?: Asset[]
}

export interface WatchLink {
    id?: number
    provider_key?: string | null
    platform: string
    url: string
    embed_url?: string | null
    embed_type?: string | null
    source_kind?: string | null
    title?: string | null
    confidence?: number | null
    verified_at?: string | null
    is_official?: number | null
}

export interface CreditEntry {
    person_id: string
    name: string
    role?: string | null
    image_url?: string | null
}

export interface MovieArticle {
    id?: number
    category?: string | null
    title?: string | null
    link?: string | null
    domain?: string | null
    snippet?: string | null
    published_at?: string | null
}

export interface PersonCredit {
    id: string
    slug?: string
    name_ar: string
    name_en?: string | null
    profile_image?: string | null
    role_kind: string
    role_credit?: string | null
    billing_order?: number
}

export interface CompanyCredit {
    id: string
    slug?: string
    name_ar: string
    name_en?: string | null
    role_kind: string
}

export interface Genre {
    id: number
    slug: string
    name_ar: string
    name_en?: string | null
    movie_count?: number
}

export interface Tag {
    id: number
    slug: string
    name_ar: string
    name_en?: string | null
    category?: string | null
}

export interface Asset {
    id: number
    kind: string
    url?: string
    r2_key: string
    width?: number | null
    height?: number | null
}

// Simplified Person interface matching current schema
export interface Person {
    id: string
    name_ar: string | null
    name_en?: string | null
    birthdate?: string | null
    profile_image?: string | null
    bio?: string | null
    // Legacy fields
    slug?: string
    full_name?: string | null
    bio_ar?: string | null
    deathdate?: string | null
    country?: string
}

export interface PersonWithFilmography extends Person {
    filmography: Filmography
}

export interface Filmography {
    as_actor: FilmographyEntry[]
    as_director: FilmographyEntry[]
    as_writer: FilmographyEntry[]
    as_crew: FilmographyEntry[]
}

export interface FilmographyEntry {
    movie_id: string
    movie_slug: string
    title_ar: string
    title_en?: string | null
    year: number
    role_kind: string
    role_credit?: string | null
}

export interface Company {
    id: string
    slug: string
    name_ar: string
    name_en?: string | null
    kind?: string | null
    country: string
    founded_year?: number | null
    closed_year?: number | null
    description_ar?: string | null
}

export interface CompanyWithProductions extends Company {
    productions: Production[]
}

export interface Production {
    movie_id: string
    movie_slug: string
    title_ar: string
    title_en?: string | null
    year: number
    role_kind: string
}

export interface VectorSearchResult {
    movie: Movie
    score: number
    similarity?: number
    source?: "hybrid" | "vector" | "keyword"
}

export interface VectorSearchResponse {
    results: VectorSearchResult[]
    fallback?: boolean
    warning?: string
}

export interface Premiere {
    id: string
    slug?: string | null
    title?: string | null
    title_ar?: string | null
    title_en?: string | null
    year?: number | null
    release_date?: string | null
}

export interface OnThisDayPayload {
    month: number
    day: number
    born: {
        people: Person[]
        count: number
    }
    died: {
        people: Person[]
        count: number
    }
    premieres: Premiere[]
    premieresSupported: boolean
    note?: string
}

interface RawOnThisDayPayload {
    month: number
    day: number
    born: Person[] | { people?: Person[]; count?: number }
    died: Person[] | { people?: Person[]; count?: number }
    premieres?: Premiere[]
    premieresSupported?: boolean
    note?: string
}

function normalizePeopleBucket(value: RawOnThisDayPayload["born"]) {
    if (Array.isArray(value)) {
        return {
            people: value,
            count: value.length,
        }
    }

    const people = value?.people || []
    return {
        people,
        count: value?.count ?? people.length,
    }
}

export interface ListResponse<T> {
    count: number
    limit: number
    offset: number
    data: T[]
}

export interface CuratedMovieListEntry {
    rank: number
    title_ar: string
    year: number
    director?: string | null
    lookup_title_ar?: string
    movie: Movie | null
}

export interface CuratedMovieList {
    slug: string
    title_ar: string
    description_ar: string
    source_name: string
    source_url: string
    entries: CuratedMovieListEntry[]
    count: number
    matched_count: number
}

// API Client
export const api = {
    // ============================================================
    // MOVIES
    // ============================================================

    // Get movie by slug
    async getMovie(slug: string) {
        return fetchJson<{ movie: MovieWithRelations }>(`${API_BASE_URL}/api/movies/${slug}`, 'Failed to fetch movie')
    },

    // List movies with filters
    async listMovies(options?: {
        year?: number
        yearMin?: number
        yearMax?: number
        decade?: number
        genreId?: number
        orderBy?: 'year' | 'title' | 'rating'
        direction?: 'ASC' | 'DESC'
        limit?: number
        offset?: number
    }) {
        const params = new URLSearchParams()
        if (options?.year) params.set('year', options.year.toString())
        if (options?.yearMin) params.set('yearMin', options.yearMin.toString())
        if (options?.yearMax) params.set('yearMax', options.yearMax.toString())
        if (options?.decade) params.set('decade', options.decade.toString())
        if (options?.genreId) params.set('genreId', options.genreId.toString())
        if (options?.orderBy) params.set('orderBy', options.orderBy)
        if (options?.direction) params.set('direction', options.direction)
        if (options?.limit) params.set('limit', options.limit.toString())
        if (options?.offset) params.set('offset', options.offset.toString())

        return fetchJson<{ movies: Movie[]; count: number; limit: number; offset: number }>(`${API_BASE_URL}/api/movies?${params}`, 'Failed to list movies')
    },

    // Search movies
    async searchMovies(query: string, limit = 20) {
        const params = new URLSearchParams({ q: query, limit: limit.toString() })
        return fetchJson<{ movies: Movie[]; count: number }>(`${API_BASE_URL}/api/movies/search?${params}`, 'Failed to search movies')
    },

    // Vector Search
    async vectorSearch(query: string, options?: { yearMin?: number; yearMax?: number; limit?: number }) {
        const params = new URLSearchParams({ q: query })
        if (options?.yearMin) params.set('yearMin', options.yearMin.toString())
        if (options?.yearMax) params.set('yearMax', options.yearMax.toString())
        if (options?.limit) params.set('limit', options.limit.toString())

        return fetchJson<VectorSearchResponse>(`${API_BASE_URL}/api/vector-search?${params}`, 'Failed to search')
    },

    // Similar Movies
    async getSimilarMovies(slug: string, limit = 6) {
        return fetchJson<VectorSearchResponse>(`${API_BASE_URL}/api/movies/${slug}/similar?limit=${limit}`, 'Failed to fetch similar movies')
    },

    // Curated Movie Lists
    async getMovieList(slug: string) {
        return fetchJson<{ list: CuratedMovieList }>(`${API_BASE_URL}/api/movie-lists/${slug}`, 'Failed to fetch movie list')
    },

    // List genres
    async listGenres() {
        return fetchJson<{ genres: Genre[]; count: number }>(`${API_BASE_URL}/api/genres`, 'Failed to list genres')
    },

    // ============================================================
    // PEOPLE
    // ============================================================

    // Get person by slug
    async getPerson(slug: string) {
        return fetchJson<{ person: PersonWithFilmography }>(`${API_BASE_URL}/api/people/${slug}`, 'Failed to fetch person')
    },

    // List people
    async listPeople(options?: {
        roleKind?: string
        orderBy?: 'name_ar' | 'name_en'
        limit?: number
        offset?: number
    }) {
        const params = new URLSearchParams()
        if (options?.roleKind) params.set('roleKind', options.roleKind)
        if (options?.orderBy) params.set('orderBy', options.orderBy)
        if (options?.limit) params.set('limit', options.limit.toString())
        if (options?.offset) params.set('offset', options.offset.toString())

        return fetchJson<{ people: Person[]; count: number; limit: number; offset: number }>(`${API_BASE_URL}/api/people?${params}`, 'Failed to list people')
    },

    // Search people
    async searchPeople(query: string, limit = 20) {
        const params = new URLSearchParams({ q: query, limit: limit.toString() })
        return fetchJson<{ people: Person[]; count: number }>(`${API_BASE_URL}/api/people/search?${params}`, 'Failed to search people')
    },

    // Get people born on this day
    async getPeopleBornOn(month?: number, day?: number, limit = 20) {
        const params = new URLSearchParams({ limit: limit.toString() })
        if (month) params.set('month', month.toString())
        if (day) params.set('day', day.toString())

        return fetchJson<{ people: Person[]; count: number }>(`${API_BASE_URL}/api/people/born-on-this-day?${params}`, 'Failed to fetch people born on this day')
    },

    // Get people died on this day
    async getPeopleDiedOn(month?: number, day?: number, limit = 20) {
        const params = new URLSearchParams({ limit: limit.toString() })
        if (month) params.set('month', month.toString())
        if (day) params.set('day', day.toString())

        return fetchJson<{ people: Person[]; count: number }>(`${API_BASE_URL}/api/people/died-on-this-day?${params}`, 'Failed to fetch people died on this day')
    },

    async getOnThisDay(month?: number, day?: number, limit = 20) {
        const params = new URLSearchParams({ limit: limit.toString() })
        if (month) params.set('month', month.toString())
        if (day) params.set('day', day.toString())

        const payload = await fetchJson<RawOnThisDayPayload>(`${API_BASE_URL}/api/on-this-day?${params}`, 'Failed to fetch on this day data')

        return {
            month: payload.month,
            day: payload.day,
            born: normalizePeopleBucket(payload.born),
            died: normalizePeopleBucket(payload.died),
            premieres: payload.premieres || [],
            premieresSupported: payload.premieresSupported ?? (payload.premieres || []).length > 0,
            note: payload.note,
        } satisfies OnThisDayPayload
    },

    // ============================================================
    // COMPANIES
    // ============================================================

    // Get company by slug
    async getCompany(slug: string) {
        return fetchJson<{ company: CompanyWithProductions }>(`${API_BASE_URL}/api/companies/${slug}`, 'Failed to fetch company')
    },

    // List companies
    async listCompanies(options?: {
        kind?: string
        orderBy?: 'name_ar' | 'founded_year'
        limit?: number
        offset?: number
    }) {
        const params = new URLSearchParams()
        if (options?.kind) params.set('kind', options.kind)
        if (options?.orderBy) params.set('orderBy', options.orderBy)
        if (options?.limit) params.set('limit', options.limit.toString())
        if (options?.offset) params.set('offset', options.offset.toString())

        return fetchJson<{ companies: Company[]; count: number; limit: number; offset: number }>(`${API_BASE_URL}/api/companies?${params}`, 'Failed to list companies')
    },

    // Search companies
    async searchCompanies(query: string, limit = 20) {
        const params = new URLSearchParams({ q: query, limit: limit.toString() })
        return fetchJson<{ companies: Company[]; count: number }>(`${API_BASE_URL}/api/companies/search?${params}`, 'Failed to search companies')
    },

    // Health Check
    async ping() {
        const res = await fetch(API_BASE_URL)
        return res.json()
    },
}
