import { api, type Movie, type Person, type VectorSearchResult } from "./api"

type PagefindResultSource = {
  id?: string
  url?: string
  score?: number
  excerpt?: string
  content?: string
  meta?: Record<string, unknown>
  data?: () => Promise<Record<string, unknown> | undefined>
}

type PagefindModule = {
  init?: () => Promise<unknown> | unknown
  search: (query: string) => Promise<PagefindResultSource[] | { results?: PagefindResultSource[] } | undefined> | PagefindResultSource[] | { results?: PagefindResultSource[] } | undefined
}

export type HybridSearchHit =
  | {
      kind: "movie"
      id: string
      slug: string
      score: number
      source: "vector" | "pagefind" | "hybrid"
      movie: Movie
      sources: {
        vector?: number
        pagefind?: number
      }
    }
  | {
      kind: "person"
      id: string
      slug: string
      score: number
      source: "vector" | "pagefind" | "hybrid"
      person: Person
      sources: {
        vector?: number
        pagefind?: number
      }
    }

interface HybridSearchOptions {
  limit?: number
  yearMin?: number
  yearMax?: number
}

interface RankedCandidate {
  kind: "movie" | "person"
  id: string
  slug: string
  movie?: Movie
  person?: Person
  vectorRank?: number
  pagefindRank?: number
  vectorScore?: number
  pagefindScore?: number
  exactMatch?: boolean
  source: "vector" | "pagefind" | "hybrid"
}

const PAGEFIND_IMPORT_PATH = "/pagefind/pagefind.js"
const PAGEFIND_ENABLED = process.env.NEXT_PUBLIC_PAGEFIND_ENABLED === "true"
const RRF_K = 60
const EXACT_MATCH_BOOST = 2.5

function normalizeText(value?: string | null) {
  return (value || "")
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase()
}

function slugFromPath(value?: string | null) {
  if (!value) {
    return ""
  }

  const raw = value.startsWith("http://") || value.startsWith("https://")
    ? new URL(value).pathname
    : value

  return raw.replace(/^\/+/, "").replace(/\/+$/, "")
}

function pagefindKindFromPath(pathname: string) {
  if (pathname.startsWith("people/")) {
    return "person" as const
  }

  return "movie" as const
}

function createFallbackMovie(slug: string, title: string): Movie {
  return {
    id: slug || title,
    slug: slug || undefined,
    title,
    year: "",
  }
}

function createFallbackPerson(slug: string, title: string): Person {
  return {
    id: slug || title,
    slug: slug || undefined,
    name_ar: title,
  }
}

function extractPagefindTitle(hit: PagefindResultSource) {
  const data = hit.meta || {}
  const titleCandidates = [
    typeof data.title === "string" ? data.title : null,
    typeof data.name === "string" ? data.name : null,
    typeof data.h1 === "string" ? data.h1 : null,
    typeof data["title_ar"] === "string" ? data["title_ar"] : null,
    typeof data["name_ar"] === "string" ? data["name_ar"] : null,
    hit.excerpt || hit.content || null,
  ]

  return titleCandidates.find((value): value is string => Boolean(value)) || ""
}

async function loadPagefindModule(): Promise<PagefindModule | null> {
  if (typeof window === "undefined" || !PAGEFIND_ENABLED) {
    return null
  }

  try {
    const loadedModule = (await import(PAGEFIND_IMPORT_PATH)) as unknown as { default?: PagefindModule } & PagefindModule
    const pagefind = loadedModule.default || loadedModule

    if (typeof pagefind.init === "function") {
      await pagefind.init()
    }

    return pagefind
  } catch {
    return null
  }
}

async function searchPagefind(query: string, limit: number) {
  const pagefind = await loadPagefindModule()
  if (!pagefind) {
    return []
  }

  try {
    const raw = await pagefind.search(query)
    const hits = Array.isArray(raw) ? raw : raw?.results || []

    return await Promise.all(
      hits.slice(0, limit).map(async (hit, rank) => {
        const data = typeof hit.data === "function" ? await hit.data().catch(() => undefined) : undefined
        const pathname = slugFromPath((data?.url as string | undefined) || hit.url || hit.id || "")
        const kind = pagefindKindFromPath(pathname)
        const slug = pathname.replace(/^(movies|people)\//, "")
        const title = extractPagefindTitle(hit) || slug
        const normalizedTitle = normalizeText(title)

        return {
          kind,
          id: slug || title,
          slug: slug || title,
          title,
          normalizedTitle,
          rank,
          score: typeof hit.score === "number" ? hit.score : 1,
          data,
        }
      })
    )
  } catch {
    return []
  }
}

function rankVectorResults(query: string, results: VectorSearchResult[]) {
  const normalizedQuery = normalizeText(query)

  return results.map((result, rank) => {
    const movie = result.movie
    const slug = movie.slug || movie.id
    const normalizedTitle = normalizeText(movie.title_ar || movie.title || movie.title_en)

    return {
      kind: "movie" as const,
      id: movie.id,
      slug,
      movie,
      rank,
      score: typeof result.score === "number" ? result.score : 1,
      exactMatch: normalizedQuery && normalizedTitle === normalizedQuery,
      normalizedTitle,
    }
  })
}

function buildCandidateMap() {
  return new Map<string, RankedCandidate>()
}

function scoreCandidate(candidate: RankedCandidate) {
  const vectorScore = candidate.vectorRank !== undefined ? 1 / (RRF_K + candidate.vectorRank + 1) : 0
  const pagefindScore = candidate.pagefindRank !== undefined ? 1 / (RRF_K + candidate.pagefindRank + 1) : 0
  const exactBoost = candidate.exactMatch ? EXACT_MATCH_BOOST : 0

  return vectorScore + pagefindScore + exactBoost
}

function mergeVectorAndPagefind(
  query: string,
  vectorResults: VectorSearchResult[],
  pagefindResults: Awaited<ReturnType<typeof searchPagefind>>,
  limit: number
): HybridSearchHit[] {
  const normalizedQuery = normalizeText(query)
  const candidates = buildCandidateMap()
  const vectorRanked = rankVectorResults(query, vectorResults)

  for (const result of vectorRanked) {
    const key = `movie:${result.slug}`
    const existing = candidates.get(key)
    const source = existing || {
      kind: "movie" as const,
      id: result.id,
      slug: result.slug,
      movie: result.movie,
      source: "vector" as const,
    }

    source.movie = result.movie
    source.vectorRank = result.rank
    source.vectorScore = result.score
    source.source = source.pagefindRank !== undefined ? "hybrid" : "vector"
    candidates.set(key, source)
  }

  for (const resultPromise of pagefindResults) {
    const result = resultPromise
    const key = `${result.kind}:${result.slug}`
    const existing = candidates.get(key)
    const source = existing || {
      kind: result.kind,
      id: result.id,
      slug: result.slug,
      source: "pagefind" as const,
    }

    source.pagefindRank = result.rank
    source.pagefindScore = result.score
    source.source = source.vectorRank !== undefined ? "hybrid" : "pagefind"

    if (result.kind === "movie") {
      source.movie = source.movie || createFallbackMovie(result.slug, result.title)
      source.exactMatch = Boolean(normalizedQuery && normalizeText(result.normalizedTitle) === normalizedQuery)
    } else {
      source.person = source.person || createFallbackPerson(result.slug, result.title)
      source.exactMatch = Boolean(normalizedQuery && normalizeText(result.normalizedTitle) === normalizedQuery)
    }

    candidates.set(key, source)
  }

  const hits = Array.from(candidates.values())
    .map((candidate) => ({
      ...candidate,
      score: scoreCandidate(candidate),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)

  return hits.map((candidate) =>
    candidate.kind === "movie"
      ? {
          kind: "movie",
          id: candidate.id,
          slug: candidate.slug,
          score: candidate.score,
          source: candidate.source,
          movie: candidate.movie || createFallbackMovie(candidate.slug, candidate.id),
          sources: {
            vector: candidate.vectorScore,
            pagefind: candidate.pagefindScore,
          },
        }
      : {
          kind: "person",
          id: candidate.id,
          slug: candidate.slug,
          score: candidate.score,
          source: candidate.source,
          person: candidate.person || createFallbackPerson(candidate.slug, candidate.id),
          sources: {
            vector: candidate.vectorScore,
            pagefind: candidate.pagefindScore,
          },
        }
  )
}

export class HybridSearchClient {
  async search(query: string, options: HybridSearchOptions = {}): Promise<HybridSearchHit[]> {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) {
      return []
    }

    const limit = options.limit ?? 20

    const [vectorResponse, pagefindResults] = await Promise.all([
      api.vectorSearch(trimmedQuery, {
        yearMin: options.yearMin,
        yearMax: options.yearMax,
        limit,
      }),
      searchPagefind(trimmedQuery, limit),
    ])

    return mergeVectorAndPagefind(trimmedQuery, vectorResponse.results || [], pagefindResults, limit)
  }
}

export const hybridSearchClient = new HybridSearchClient()

export async function hybridSearch(query: string, options: HybridSearchOptions = {}) {
  return hybridSearchClient.search(query, options)
}
