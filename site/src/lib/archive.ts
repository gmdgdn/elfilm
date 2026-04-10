import { env } from "cloudflare:workers"

interface ArchiveEnv {
  DB: D1Database
  VECTORIZE: VectorizeIndex
  AI: Ai
  ASSET_BASE_URL?: string
  ADMIN_API_KEY?: string
}

const runtimeEnv = env as unknown as ArchiveEnv

export interface ArchiveMovie {
  id: string
  slug: string | null
  title: string | null
  title_ar: string | null
  title_en: string | null
  year: number | null
  poster_url: string | null
  summary_ar: string | null
  story: string | null
  duration_minutes: number | null
  rating: number | null
  work_type: string | null
  release_date?: string | null
  country: string | null
  language: string | null
}

export interface ArchiveGenre {
  id: number
  slug: string
  name_ar: string
  name_en: string | null
  movie_count?: number | null
}

export interface ArchiveTag {
  id: number
  slug: string
  name_ar: string
  name_en: string | null
  category: string | null
}

export interface ArchivePersonCredit {
  id: string
  slug: string | null
  name_ar: string | null
  name_en: string | null
  profile_image: string | null
  role_kind: string
  role_credit: string | null
  billing_order: number | null
}

export interface ArchiveCompanyCredit {
  id: string
  slug: string | null
  name_ar: string
  name_en: string | null
  role_kind: string
}

export interface ArchiveWatchLink {
  id: number
  platform: string
  url: string
  title: string | null
  source_kind: string | null
  is_official: number | null
  embed_url: string | null
  embed_type: string | null
  confidence: number | null
  verified_at: string | null
}

export interface ArchiveMovieDetail extends ArchiveMovie {
  genres: ArchiveGenre[]
  tags: ArchiveTag[]
  people: ArchivePersonCredit[]
  companies: ArchiveCompanyCredit[]
  watchLinks: ArchiveWatchLink[]
}

export interface ArchiveFilmographyEntry {
  movie_id: string
  movie_slug: string | null
  title_ar: string | null
  title_en: string | null
  year: number | null
  role_kind: string
  role_credit: string | null
}

export interface ArchivePerson {
  id: string
  slug: string | null
  name_ar: string | null
  name_en: string | null
  birthdate: string | null
  deathdate: string | null
  country: string | null
  profile_image: string | null
  bio_ar: string | null
}

export interface ArchivePersonDetail extends ArchivePerson {
  filmography: ArchiveFilmographyEntry[]
}

export interface ArchiveDayHighlight {
  people: ArchivePerson[]
  count: number
}

export interface ArchivePremiere {
  id: string
  slug: string | null
  title_ar: string | null
  title_en: string | null
  title: string | null
  year: number | null
  release_date: string | null
}

export interface ArchiveCompany {
  id: string
  slug: string | null
  name_ar: string
  name_en: string | null
  kind: string | null
  country: string | null
  founded_year: number | null
  closed_year: number | null
  description_ar: string | null
}

export interface ArchiveProduction {
  movie_id: string
  movie_slug: string | null
  title_ar: string | null
  title_en: string | null
  year: number | null
  role_kind: string
}

export interface ArchiveCompanyDetail extends ArchiveCompany {
  productions: ArchiveProduction[]
}

export interface ArchiveStats {
  movies: number
  people: number
  companies: number
  genres: number
}

export interface ArchiveSearchOptions {
  query: string
  limit?: number
  yearMin?: number
  yearMax?: number
  workType?: string
}

export interface ArchiveSearchResult extends ArchiveMovie {
  similarity: number
  source: "hybrid" | "vector" | "keyword"
}

interface ArchiveSearchPlan {
  originalQuery: string
  retrievalQuery: string
  rankingQuery: string
  yearMin?: number
  yearMax?: number
  workType?: string
}

interface SearchableArchiveMovie extends ArchiveMovie {
  search_genres?: string | null
  cast_names?: string | null
  crew_names?: string | null
  tag_names?: string | null
  company_names?: string | null
  search_document?: string
}

export interface ArchiveMovieListOptions {
  limit?: number
  offset?: number
  genreId?: number
  yearMin?: number
  yearMax?: number
  decade?: number
  orderBy?: "year" | "title" | "rating"
  direction?: "ASC" | "DESC"
}

function buildMovieFilterClause(options: ArchiveMovieListOptions) {
  const { genreId, yearMin, yearMax, decade } = options
  const conditions: string[] = []
  const params: unknown[] = []

  if (genreId) {
    conditions.push(`id IN (SELECT movie_id FROM movie_genres WHERE genre_id = ?)`)
    params.push(genreId)
  }

  const derivedYearMin = decade ?? yearMin
  const derivedYearMax = decade ? decade + 9 : yearMax

  if (derivedYearMin) {
    conditions.push("year >= ?")
    params.push(derivedYearMin)
  }

  if (derivedYearMax) {
    conditions.push("year <= ?")
    params.push(derivedYearMax)
  }

  return {
    whereClause: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  }
}

const DEFAULT_ASSET_BASE_URL = "https://elfilm.anagmdgdn.workers.dev"

function getAssetBaseUrl() {
  return runtimeEnv.ASSET_BASE_URL || DEFAULT_ASSET_BASE_URL
}

function rewritePublicAssetUrl(value: string | null | undefined) {
  if (!value) {
    return value ?? null
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      const url = new URL(value)
      if (url.pathname.startsWith("/assets/elfilm/")) {
        return `${getAssetBaseUrl()}${url.pathname}${url.search}${url.hash}`
      }
      if (url.hostname === "elfilm.net" && url.pathname.startsWith("/assets/")) {
        return `${getAssetBaseUrl()}${url.pathname}${url.search}${url.hash}`
      }
    } catch {
      // Fall through to legacy string rewrites below.
    }
  }

  if (value.startsWith("/assets/elfilm/")) {
    return `${getAssetBaseUrl()}${value}`
  }

  return value.replace(/^https:\/\/elfilm\.net\/assets\//, `${getAssetBaseUrl()}/assets/`)
}

function decorateMovie<T extends ArchiveMovie>(movie: T): T {
  return {
    ...movie,
    poster_url: rewritePublicAssetUrl(movie.poster_url),
  }
}

async function queryAll<T>(query: string, ...params: unknown[]) {
  const statement = runtimeEnv.DB.prepare(query)
  const result = params.length > 0 ? await statement.bind(...params).all<T>() : await statement.all<T>()

  if (!result.success) {
    throw new Error(result.error || "D1 query failed")
  }

  return result.results ?? []
}

async function queryFirst<T>(query: string, ...params: unknown[]) {
  const statement = runtimeEnv.DB.prepare(query)
  return params.length > 0 ? statement.bind(...params).first<T>() : statement.first<T>()
}

function monthDay(value: number) {
  return String(value).padStart(2, "0")
}

function tokenizeSearchQuery(query: string) {
  return Array.from(new Set(query.trim().toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])).slice(0, 8)
}

function buildFtsMatchQuery(query: string) {
  const tokens = tokenizeSearchQuery(query)

  if (tokens.length === 0) {
    return query.trim().replace(/"/g, '""')
  }

  return Array.from(
    new Set([
      `"${query.trim().replace(/"/g, '""')}"`,
      ...tokens.map((token) => `${token}*`),
    ])
  ).join(" OR ")
}

function buildSearchDocument(movie: Partial<SearchableArchiveMovie>) {
  return [
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
  ]
    .filter(Boolean)
    .join("\n")
}

function buildSearchFilterClause(yearMin?: number, yearMax?: number) {
  const conditions: string[] = []
  const params: unknown[] = []

  if (yearMin) {
    conditions.push("m.year >= ?")
    params.push(yearMin)
  }

  if (yearMax) {
    conditions.push("m.year <= ?")
    params.push(yearMax)
  }

  return {
    clause: conditions.length > 0 ? ` AND ${conditions.join(" AND ")}` : "",
    params,
  }
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ؤ]/g, "و")
    .replace(/[ئ]/g, "ي")
    .replace(/[ى]/g, "ي")
    .replace(/[ة]/g, "ه")
    .replace(/ـ/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function buildSearchPlan(options: ArchiveSearchOptions): ArchiveSearchPlan {
  const originalQuery = options.query.trim()
  const normalizedOriginal = normalizeSearchText(originalQuery)
  const detectedYear = normalizedOriginal.match(/\b(18|19|20)\d{2}\b/)?.[0]
  const inferredYear =
    detectedYear && !options.yearMin && !options.yearMax ? Number.parseInt(detectedYear, 10) : undefined

  const workTypeHints = [
    { pattern: /\b(فيلم|فلم|movie|film|cinema)\b/giu, value: "فيلم" },
  ]

  let workType = options.workType
  let strippedQuery = originalQuery
  for (const hint of workTypeHints) {
    if (!workType && hint.pattern.test(originalQuery)) {
      workType = hint.value
    }
    strippedQuery = strippedQuery.replace(hint.pattern, " ")
  }

  const retrievalQuery = strippedQuery
    .replace(/\b(18|19|20)\d{2}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  return {
    originalQuery,
    retrievalQuery: retrievalQuery || originalQuery,
    rankingQuery: retrievalQuery || originalQuery,
    yearMin: options.yearMin ?? inferredYear,
    yearMax: options.yearMax ?? inferredYear,
    workType,
  }
}

function exactMatchBoost(
  query: string,
  movie: Pick<SearchableArchiveMovie, "title_ar" | "title" | "title_en">
) {
  const tier = titleMatchTier(query, movie)
  if (tier === 2) {
    return 0.08
  }

  if (tier === 1) {
    return 0.04
  }

  return 0
}

function titleMatchTier(
  query: string,
  movie: Pick<SearchableArchiveMovie, "title_ar" | "title" | "title_en">
) {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) {
    return 0
  }

  const titles = [movie.title_ar, movie.title, movie.title_en]
    .filter(Boolean)
    .map((value) => normalizeSearchText(String(value)))

  if (titles.some((title) => title === normalizedQuery)) {
    return 2
  }

  if (titles.some((title) => title.startsWith(normalizedQuery))) {
    return 1
  }

  return 0
}

function withinYearRange(movie: ArchiveMovie, yearMin?: number, yearMax?: number) {
  if (yearMin && Number(movie.year) < yearMin) {
    return false
  }

  if (yearMax && Number(movie.year) > yearMax) {
    return false
  }

  return true
}

function withinSearchFilters(
  movie: SearchableArchiveMovie,
  options: Pick<ArchiveSearchPlan, "yearMin" | "yearMax" | "workType">
) {
  if (!withinYearRange(movie, options.yearMin, options.yearMax)) {
    return false
  }

  if (options.workType) {
    const movieType = String(movie.work_type || "").trim()
    if (movieType && movieType !== options.workType) {
      return false
    }
  }

  return true
}

async function getSearchableMoviesByIds(movieIds: string[]) {
  if (movieIds.length === 0) {
    return []
  }

  const placeholders = movieIds.map(() => "?").join(",")
  const rows = await queryAll<SearchableArchiveMovie>(
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
  )

  return rows.map((movie) => ({
    ...decorateMovie(movie),
    search_document: buildSearchDocument(movie),
  }))
}

let supportsMovieReleaseDatePromise: Promise<boolean> | null = null

async function supportsMovieReleaseDate() {
  supportsMovieReleaseDatePromise ??= queryAll<{ name: string }>("PRAGMA table_info(movies)")
    .then((columns) => columns.some((column) => column.name === "release_date"))
    .catch(() => false)

  return supportsMovieReleaseDatePromise
}

export async function getArchiveStats(): Promise<ArchiveStats> {
  const [movies, people, companies, genres] = await Promise.all([
    queryFirst<{ count: number }>("SELECT COUNT(*) as count FROM movies"),
    queryFirst<{ count: number }>("SELECT COUNT(*) as count FROM people"),
    queryFirst<{ count: number }>("SELECT COUNT(*) as count FROM companies"),
    queryFirst<{ count: number }>("SELECT COUNT(*) as count FROM genres"),
  ])

  return {
    movies: movies?.count ?? 0,
    people: people?.count ?? 0,
    companies: companies?.count ?? 0,
    genres: genres?.count ?? 0,
  }
}

export async function searchMoviesKeyword(query: string, limit = 12) {
  if (!query.trim()) {
    return []
  }

  try {
    const matchQuery = buildFtsMatchQuery(query)
    const movies = await queryAll<SearchableArchiveMovie>(
      `SELECT
          m.*,
          ms.genres as search_genres,
          ms.cast_names,
          ms.crew_names,
          bm25(movie_search, 8.0, 10.0, 6.0, 4.0, 4.0, 2.2, 1.6, 1.6) as fts_rank
       FROM movie_search
       JOIN movies m ON m.id = movie_search.movie_id
       LEFT JOIN movie_search ms ON ms.movie_id = m.id
       WHERE movie_search MATCH ?
       ORDER BY fts_rank ASC, m.rating DESC, m.year DESC
       LIMIT ?`,
      matchQuery,
      limit
    )

    if (movies.length > 0) {
      return movies.map((movie) => ({
        ...decorateMovie(movie),
        similarity: 0,
        source: "keyword" as const,
      }))
    }
  } catch {
    // Fall through to LIKE if FTS is unavailable in the current dataset.
  }

  const searchTerm = `%${query}%`
  const fallback = await queryAll<ArchiveMovie>(
    `SELECT id, slug, title, title_ar, title_en, year, poster_url, summary_ar, story, duration_minutes, rating, work_type, country, language
     FROM movies
     WHERE title LIKE ? OR title_ar LIKE ? OR title_en LIKE ? OR story LIKE ? OR summary_ar LIKE ?
     ORDER BY year DESC, rating DESC
     LIMIT ?`,
    searchTerm,
    searchTerm,
    searchTerm,
    searchTerm,
    searchTerm,
    limit
  )

  return fallback.map((movie) => ({
    ...decorateMovie(movie),
    similarity: 0,
    source: "keyword" as const,
  }))
}

export async function semanticMovieSearch(options: ArchiveSearchOptions): Promise<ArchiveSearchResult[]> {
  if (!options.query.trim()) {
    return []
  }

  try {
    const plan = buildSearchPlan(options)
    const { limit = 12 } = options
    const candidateWindow = Math.min(Math.max(limit * 4, 24), 50)
    const keywordFilter = buildSearchFilterClause(plan.yearMin, plan.yearMax)

    const [keywordCandidates, embeddingResponse] = await Promise.all([
      queryAll<SearchableArchiveMovie>(
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
            ) as company_names,
            bm25(movie_search, 8.0, 10.0, 6.0, 4.0, 4.0, 2.2, 1.6, 1.6) as fts_rank
         FROM movie_search
         JOIN movies m ON m.id = movie_search.movie_id
         LEFT JOIN movie_search ms ON ms.movie_id = m.id
         WHERE movie_search MATCH ?${keywordFilter.clause}
         ORDER BY fts_rank ASC, m.rating DESC, m.year DESC
         LIMIT ?`,
        buildFtsMatchQuery(plan.retrievalQuery),
        ...keywordFilter.params,
        candidateWindow
      ).catch(() => []),
      runtimeEnv.AI.run("@cf/baai/bge-m3", {
        text: plan.retrievalQuery,
      }) as Promise<{ data: number[][] }>,
    ])
    const queryVector = embeddingResponse.data[0]

    const vectorResults = await runtimeEnv.VECTORIZE.query(queryVector, {
      topK: candidateWindow,
      returnMetadata: "none",
      filter: buildVectorFilter(plan),
    })

    const vectorMatches = vectorResults.matches ?? []
    const vectorMovies = await getSearchableMoviesByIds(vectorMatches.map((match) => match.id))
    const vectorById = new Map(vectorMovies.map((movie) => [movie.id, movie]))

    const candidateMap = new Map<
      string,
      {
        movie: SearchableArchiveMovie
        keywordRank?: number
        vectorRank?: number
      }
    >()

    keywordCandidates
      .filter((movie) => withinSearchFilters(movie, plan))
      .forEach((movie, index) => {
        candidateMap.set(movie.id, { movie: decorateMovie(movie), keywordRank: index })
      })

    vectorMatches.forEach((match, index) => {
      const movie = vectorById.get(match.id)
      if (!movie || !withinSearchFilters(movie, plan)) {
        return
      }

      const current = candidateMap.get(movie.id)
      candidateMap.set(movie.id, {
        movie,
        keywordRank: current?.keywordRank,
        vectorRank: index,
      })
    })

    const rankedCandidates = Array.from(candidateMap.values())
      .map((candidate) => ({
        ...candidate,
        baseScore:
          (typeof candidate.vectorRank === "number" ? 0.58 / (60 + candidate.vectorRank + 1) : 0) +
          (typeof candidate.keywordRank === "number" ? 0.42 / (60 + candidate.keywordRank + 1) : 0) +
          exactMatchBoost(plan.rankingQuery, candidate.movie),
      }))
      .sort((left, right) => right.baseScore - left.baseScore)
      .slice(0, Math.max(limit * 2, 12))

    if (rankedCandidates.length === 0) {
      return searchMoviesKeyword(plan.retrievalQuery, limit)
    }

    const hasExactTitleHit = rankedCandidates.some((candidate) => titleMatchTier(plan.rankingQuery, candidate.movie) === 2)
    const rerank = hasExactTitleHit
      ? null
      : (await runtimeEnv.AI.run("@cf/baai/bge-reranker-base", {
          query: plan.retrievalQuery,
          top_k: rankedCandidates.length,
          contexts: rankedCandidates.map((candidate) => ({
            text:
              candidate.movie.search_document ||
              candidate.movie.summary_ar ||
              candidate.movie.story ||
              candidate.movie.title_ar ||
              candidate.movie.title ||
              candidate.movie.id,
          })),
        }).catch(() => null)) as { response?: Array<{ id: number; score: number }> } | null

    const rerankScores = new Map<string, number>()
    for (const item of rerank?.response ?? []) {
      const target = rankedCandidates[item.id]
      if (target) {
        rerankScores.set(target.movie.id, item.score)
      }
    }

    return rankedCandidates
      .map(({ movie, baseScore, vectorRank, keywordRank }) => ({
        ...decorateMovie(movie),
        similarity:
          rerankScores.has(movie.id)
            ? (rerankScores.get(movie.id) || 0) * 0.72 + baseScore * 0.28
            : baseScore,
        source:
          typeof vectorRank === "number" && typeof keywordRank === "number"
            ? ("hybrid" as const)
            : typeof vectorRank === "number"
              ? ("vector" as const)
              : ("keyword" as const),
      }))
      .sort((left, right) => {
        const rightTier = titleMatchTier(plan.rankingQuery, right)
        const leftTier = titleMatchTier(plan.rankingQuery, left)
        if (rightTier !== leftTier) {
          return rightTier - leftTier
        }

        return right.similarity - left.similarity
      })
      .slice(0, limit)
  } catch {
    return searchMoviesKeyword(buildSearchPlan(options).retrievalQuery, options.limit ?? 12)
  }
}

async function listMoviesForVectorIndex(limit: number, afterId?: string | null) {
  const cursorClause = afterId ? "AND m.id > ?" : ""
  const rows = await queryAll<SearchableArchiveMovie>(
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
  )

  return rows.map((movie) => ({
    ...decorateMovie(movie),
    search_document: buildSearchDocument(movie),
  }))
}

function extractEmbedding(response: unknown): number[] {
  if (
    response &&
    typeof response === "object" &&
    "data" in response &&
    Array.isArray((response as { data?: unknown }).data)
  ) {
    const data = (response as { data: unknown[] }).data[0]
    if (Array.isArray(data)) {
      return data as number[]
    }
  }

  throw new Error("Workers AI embedding response was missing vector data.")
}

function buildVectorFilter(
  options: Pick<ArchiveSearchPlan, "yearMin" | "yearMax" | "workType">
): VectorizeVectorMetadataFilter | undefined {
  const filter: VectorizeVectorMetadataFilter = {}

  if (options.workType) {
    filter.work_type = options.workType
  }

  if (options.yearMin || options.yearMax) {
    const yearRange: Record<string, number> = {}
    if (options.yearMin) {
      yearRange.$gte = options.yearMin
    }
    if (options.yearMax) {
      yearRange.$lte = options.yearMax
    }
    filter.year = yearRange
  }

  return Object.keys(filter).length > 0 ? filter : undefined
}

export async function getSearchIndexStatus() {
  const [indexInfo, movieCount] = await Promise.all([
    runtimeEnv.VECTORIZE.describe(),
    queryFirst<{ count: number }>(
      `SELECT COUNT(*) as count
       FROM movies
       WHERE COALESCE(NULLIF(summary_ar, ''), NULLIF(story, '')) IS NOT NULL`
    ),
  ])

  const vectorCount = (indexInfo as unknown as { vectorCount?: number; vectorsCount?: number }).vectorCount
    ?? (indexInfo as unknown as { vectorCount?: number; vectorsCount?: number }).vectorsCount
    ?? 0
  const dimensions = (indexInfo as unknown as { dimensions?: number; config?: { dimensions?: number } }).dimensions
    ?? (indexInfo as unknown as { dimensions?: number; config?: { dimensions?: number } }).config?.dimensions
    ?? 0
  const indexedMovies = movieCount?.count ?? 0

  return {
    vectorCount,
    dimensions,
    movieCount: indexedMovies,
    coverage: indexedMovies > 0 ? Number(((vectorCount / indexedMovies) * 100).toFixed(1)) : 0,
  }
}

export async function reindexMovieSearchBatch(limit = 50, afterId?: string | null) {
  const movies = await listMoviesForVectorIndex(limit, afterId)

  if (movies.length === 0) {
    return {
      processed: 0,
      errors: 0,
      afterId: afterId ?? null,
      nextAfterId: afterId ?? null,
      hasMore: false,
    }
  }

  const vectors: VectorizeVector[] = []
  let errors = 0

  for (const movie of movies) {
    try {
      const response = await runtimeEnv.AI.run("@cf/baai/bge-m3", {
        text:
          movie.search_document ||
          movie.summary_ar ||
          movie.story ||
          movie.title_ar ||
          movie.title ||
          movie.id,
      })

      vectors.push({
        id: movie.id,
        values: extractEmbedding(response),
        metadata: {
          title_ar: movie.title_ar || movie.title || movie.id,
          title_en: movie.title_en || undefined,
          year: Number(movie.year) || 0,
          slug: movie.slug || movie.id,
          work_type: movie.work_type || undefined,
          country: movie.country || undefined,
          language: movie.language || undefined,
          genres: movie.search_genres
            ? movie.search_genres.split(",").map((value) => value.trim()).filter(Boolean)
            : undefined,
        },
      })
    } catch {
      errors += 1
    }
  }

  if (vectors.length > 0) {
    await runtimeEnv.VECTORIZE.upsert(vectors)
  }

  const nextAfterId = movies.at(-1)?.id ?? null

  return {
    processed: vectors.length,
    errors,
    afterId: afterId ?? null,
    nextAfterId,
    hasMore: movies.length === limit,
  }
}

export async function getFeaturedMovies(limit = 8) {
  const movies = await queryAll<ArchiveMovie>(
    `SELECT id, slug, title, title_ar, title_en, year, poster_url, summary_ar, story, duration_minutes, rating, work_type, country, language
     FROM movies
     ORDER BY rating DESC, year DESC
     LIMIT ?`,
    limit
  )

  return movies.map((movie) => decorateMovie(movie))
}

export async function getRecentMovies(limit = 12) {
  const movies = await queryAll<ArchiveMovie>(
    `SELECT id, slug, title, title_ar, title_en, year, poster_url, summary_ar, story, duration_minutes, rating, work_type, country, language
     FROM movies
     ORDER BY year DESC, created_at DESC
     LIMIT ?`,
    limit
  )

  return movies.map((movie) => decorateMovie(movie))
}

export async function listMovies(options: ArchiveMovieListOptions = {}) {
  const {
    limit = 24,
    offset = 0,
    orderBy = "year",
    direction = "DESC",
  } = options
  const { whereClause, params } = buildMovieFilterClause(options)
  const safeOrderBy = orderBy === "title" ? "title_ar" : orderBy
  const safeDirection = direction === "ASC" ? "ASC" : "DESC"

  const movies = await queryAll<ArchiveMovie>(
    `SELECT id, slug, title, title_ar, title_en, year, poster_url, summary_ar, story, duration_minutes, rating, work_type, country, language
     FROM movies
     ${whereClause}
     ORDER BY ${safeOrderBy} ${safeDirection}, rating DESC
     LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset
  )

  return movies.map((movie) => decorateMovie(movie))
}

export async function countMovies(options: ArchiveMovieListOptions = {}) {
  const { whereClause, params } = buildMovieFilterClause(options)
  const result = await queryFirst<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM movies
     ${whereClause}`,
    ...params
  )

  return result?.count ?? 0
}

export async function listGenres() {
  return queryAll<ArchiveGenre>(
    `SELECT g.id, g.slug, g.name_ar, g.name_en, COUNT(mg.movie_id) as movie_count
     FROM genres g
     LEFT JOIN movie_genres mg ON mg.genre_id = g.id
     GROUP BY g.id
     ORDER BY g.name_ar`
  )
}

export async function getMovieBySlug(idOrSlug: string): Promise<ArchiveMovieDetail | null> {
  const movie = await queryFirst<ArchiveMovie>(
    `SELECT id, slug, title, title_ar, title_en, year, poster_url, summary_ar, story, duration_minutes, rating, work_type, country, language
     FROM movies
     WHERE id = ? OR slug = ?`,
    idOrSlug,
    idOrSlug
  )

  if (!movie) {
    return null
  }

  const [genres, tags, people, companies, watchLinks] = await Promise.all([
    queryAll<ArchiveGenre>(
      `SELECT g.id, g.slug, g.name_ar, g.name_en
       FROM movie_genres mg
       JOIN genres g ON g.id = mg.genre_id
       WHERE mg.movie_id = ?
       ORDER BY g.name_ar`,
      movie.id
    ),
    queryAll<ArchiveTag>(
      `SELECT t.id, t.slug, t.name_ar, t.name_en, t.category
       FROM movie_tags mt
       JOIN tags t ON t.id = mt.tag_id
       WHERE mt.movie_id = ?
       ORDER BY t.category, t.name_ar`,
      movie.id
    ),
    queryAll<ArchivePersonCredit>(
      `SELECT p.id, p.slug, p.name_ar, p.name_en, p.profile_image, mp.role_kind, mp.role_credit, mp.billing_order
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
      movie.id
    ),
    queryAll<ArchiveCompanyCredit>(
      `SELECT c.id, c.slug, c.name_ar, c.name_en, mc.role_kind
       FROM movie_companies mc
       JOIN companies c ON c.id = mc.company_id
       WHERE mc.movie_id = ?
       ORDER BY mc.role_kind, c.name_ar`,
      movie.id
    ),
    queryAll<ArchiveWatchLink>(
      `SELECT id, platform, url, title, source_kind, is_official, embed_url, embed_type, confidence, verified_at
       FROM watch_links
       WHERE movie_id = ?
       ORDER BY is_official DESC, platform ASC`,
      movie.id
    ),
  ])

  return {
    ...decorateMovie(movie),
    genres,
    tags,
    people: people.map((person) => ({
      ...person,
      profile_image: rewritePublicAssetUrl(person.profile_image),
    })),
    companies,
    watchLinks,
  }
}

export async function listPeople(limit = 24, offset = 0) {
  const people = await queryAll<ArchivePerson>(
    `SELECT id, slug, name_ar, name_en, birthdate, deathdate, country, profile_image, bio_ar
     FROM people
     ORDER BY name_ar COLLATE NOCASE
     LIMIT ? OFFSET ?`,
    limit,
    offset
  )

  return people.map((person) => ({
    ...person,
    profile_image: rewritePublicAssetUrl(person.profile_image),
  }))
}

export async function getPeopleBornOn(month: number, day: number, limit = 20): Promise<ArchiveDayHighlight> {
  const people = await queryAll<ArchivePerson>(
    `SELECT id, slug, name_ar, name_en, birthdate, deathdate, country, profile_image, bio_ar
     FROM people
     WHERE birthdate IS NOT NULL
       AND strftime('%m', birthdate) = ?
       AND strftime('%d', birthdate) = ?
     ORDER BY birthdate DESC
     LIMIT ?`,
    monthDay(month),
    monthDay(day),
    limit
  )

  return {
    people: people.map((person) => ({
      ...person,
      profile_image: rewritePublicAssetUrl(person.profile_image),
    })),
    count: people.length,
  }
}

export async function getPeopleDiedOn(month: number, day: number, limit = 20): Promise<ArchiveDayHighlight> {
  const people = await queryAll<ArchivePerson>(
    `SELECT id, slug, name_ar, name_en, birthdate, deathdate, country, profile_image, bio_ar
     FROM people
     WHERE deathdate IS NOT NULL
       AND strftime('%m', deathdate) = ?
       AND strftime('%d', deathdate) = ?
     ORDER BY deathdate DESC
     LIMIT ?`,
    monthDay(month),
    monthDay(day),
    limit
  )

  return {
    people: people.map((person) => ({
      ...person,
      profile_image: rewritePublicAssetUrl(person.profile_image),
    })),
    count: people.length,
  }
}

export async function getTodayHighlights(month: number, day: number, limit = 20) {
  const [born, died, premieres] = await Promise.all([
    getPeopleBornOn(month, day, limit),
    getPeopleDiedOn(month, day, limit),
    getMoviesReleasedOn(month, day, limit),
  ])

  return { born, died, premieres }
}

export async function getMoviesReleasedOn(month: number, day: number, limit = 20): Promise<ArchivePremiere[]> {
  if (!(await supportsMovieReleaseDate())) {
    return []
  }

  return queryAll<ArchivePremiere>(
    `SELECT id, slug, title_ar, title_en, title, year, release_date
     FROM movies
     WHERE release_date IS NOT NULL
       AND strftime('%m', release_date) = ?
       AND strftime('%d', release_date) = ?
     ORDER BY release_date DESC, year DESC
     LIMIT ?`,
    monthDay(month),
    monthDay(day),
    limit
  )
}

export async function getPersonBySlug(idOrSlug: string): Promise<ArchivePersonDetail | null> {
  const person = await queryFirst<ArchivePerson>(
    `SELECT id, slug, name_ar, name_en, birthdate, deathdate, country, profile_image, bio_ar
     FROM people
     WHERE id = ? OR slug = ?`,
    idOrSlug,
    idOrSlug
  )

  if (!person) {
    return null
  }

  const filmography = await queryAll<ArchiveFilmographyEntry>(
    `SELECT m.id as movie_id, m.slug as movie_slug, m.title_ar, m.title_en, m.year, mp.role_kind, mp.role_credit
     FROM movie_people mp
     JOIN movies m ON m.id = mp.movie_id
     WHERE mp.person_id = ?
     ORDER BY m.year DESC, m.title_ar`,
    person.id
  )

  return {
    ...person,
    profile_image: rewritePublicAssetUrl(person.profile_image),
    filmography,
  }
}

export async function listCompanies(limit = 24, offset = 0) {
  return queryAll<ArchiveCompany>(
    `SELECT id, slug, name_ar, name_en, kind, country, founded_year, closed_year, description_ar
     FROM companies
     ORDER BY name_ar COLLATE NOCASE
     LIMIT ? OFFSET ?`,
    limit,
    offset
  )
}

export async function getCompanyBySlug(idOrSlug: string): Promise<ArchiveCompanyDetail | null> {
  const company = await queryFirst<ArchiveCompany>(
    `SELECT id, slug, name_ar, name_en, kind, country, founded_year, closed_year, description_ar
     FROM companies
     WHERE id = ? OR slug = ?`,
    idOrSlug,
    idOrSlug
  )

  if (!company) {
    return null
  }

  const productions = await queryAll<ArchiveProduction>(
    `SELECT m.id as movie_id, m.slug as movie_slug, m.title_ar, m.title_en, m.year, mc.role_kind
     FROM movie_companies mc
     JOIN movies m ON m.id = mc.movie_id
     WHERE mc.company_id = ?
     ORDER BY m.year DESC, m.title_ar`,
    company.id
  )

  return {
    ...company,
    productions,
  }
}
