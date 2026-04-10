import type { MetadataRoute } from "next"

import { api } from "@/lib/api"

const SITE_URL = "https://film.gmd.gdn"
const CHUNK_SIZE = 40000

const STATIC_ROUTES: MetadataRoute.Sitemap = [
  {
    url: SITE_URL,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 1,
  },
  {
    url: `${SITE_URL}/movies`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 0.9,
  },
  {
    url: `${SITE_URL}/movies/lists/top-100-egyptian-movies`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.85,
  },
  {
    url: `${SITE_URL}/people`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  },
  {
    url: `${SITE_URL}/companies`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    url: `${SITE_URL}/genres`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    url: `${SITE_URL}/search`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.7,
  },
  {
    url: `${SITE_URL}/on-this-day`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 0.7,
  },
]

interface SitemapRow {
  slug?: string | null
  id: string
  updated_at?: string | null
  year?: number | string | null
}

function parseLastModified(value?: string | null) {
  if (!value) {
    return new Date()
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

function mapMovieSitemapEntry(movie: SitemapRow): MetadataRoute.Sitemap[number] {
  return {
    url: `${SITE_URL}/movies/${movie.slug || movie.id}`,
    lastModified: parseLastModified(movie.updated_at),
    changeFrequency: "monthly",
    priority: 0.8,
  }
}

function mapPersonSitemapEntry(person: SitemapRow): MetadataRoute.Sitemap[number] {
  return {
    url: `${SITE_URL}/people/${person.slug || person.id}`,
    lastModified: parseLastModified(person.updated_at),
    changeFrequency: "monthly",
    priority: 0.6,
  }
}

export async function generateSitemaps() {
  const [{ count: movieCount }, { count: personCount }] = await Promise.all([
    api.listMovies({ limit: 1, offset: 0 }),
    api.listPeople({ limit: 1, offset: 0 }),
  ])

  const totalEntries = movieCount + personCount
  const chunkCount = Math.max(Math.ceil(totalEntries / CHUNK_SIZE), 1)

  return Array.from({ length: chunkCount }, (_, id) => ({
    id: String(id),
  }))
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const chunkIndex = Number.parseInt(await props.id, 10) || 0
  const chunkStart = chunkIndex * CHUNK_SIZE
  const chunkEnd = chunkStart + CHUNK_SIZE

  const [{ count: movieCount }, { count: personCount }] = await Promise.all([
    api.listMovies({ limit: 1, offset: 0 }),
    api.listPeople({ limit: 1, offset: 0 }),
  ])

  const routes: MetadataRoute.Sitemap = chunkIndex === 0 ? [...STATIC_ROUTES] : []
  const movieStart = Math.min(chunkStart, movieCount)
  const movieEnd = Math.min(chunkEnd, movieCount)
  const peopleStart = Math.max(chunkStart - movieCount, 0)
  const peopleEnd = Math.max(Math.min(chunkEnd - movieCount, personCount), 0)

  const [moviesResponse, peopleResponse] = await Promise.all([
    movieEnd > movieStart
      ? api.listMovies({ limit: movieEnd - movieStart, offset: movieStart })
      : Promise.resolve({ movies: [] }),
    peopleEnd > peopleStart
      ? api.listPeople({ limit: peopleEnd - peopleStart, offset: peopleStart })
      : Promise.resolve({ people: [] }),
  ])

  routes.push(
    ...moviesResponse.movies.map((movie) => mapMovieSitemapEntry(movie as SitemapRow)),
    ...peopleResponse.people.map((person) => mapPersonSitemapEntry(person as SitemapRow))
  )

  return routes
}
