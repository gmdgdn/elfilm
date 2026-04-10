import type { Metadata } from "next"

import type { Company, CompanyWithProductions, Movie, MovieWithRelations, Person, PersonWithFilmography } from "./api"

export const SITE_URL = "https://film.gmd.gdn"
export const SITE_NAME = "ElFilm Archive"

interface JsonLdBase {
  "@context": "https://schema.org"
}

interface PersonReference {
  "@type": "Person"
  name: string
  url?: string
}

interface OrganizationReference {
  "@type": "Organization"
  name: string
  url?: string
}

type ItemListEntityType = "Movie" | "Person" | "Organization"

interface ItemListEntity {
  "@type": ItemListEntityType
  name: string
  url: string
  image?: string
  description?: string
  dateCreated?: string
  foundingDate?: string
}

export interface JsonLdWebSite extends JsonLdBase {
  "@type": "WebSite"
  name: string
  alternateName?: string
  url: string
  inLanguage: string
  publisher: OrganizationReference
  potentialAction: {
    "@type": "SearchAction"
    target: {
      "@type": "EntryPoint"
      urlTemplate: string
    }
    "query-input": string
  }
}

export interface JsonLdBreadcrumbList extends JsonLdBase {
  "@type": "BreadcrumbList"
  itemListElement: Array<{
    "@type": "ListItem"
    position: number
    name: string
    item: string
  }>
}

export interface JsonLdOrganization extends JsonLdBase {
  "@type": "Organization"
  name: string
  alternateName?: string
  url: string
  description: string
  inLanguage: string
  foundingDate?: string
  dissolutionDate?: string
  location?: string
  sameAs?: string[]
}

export interface JsonLdMovie extends JsonLdBase {
  "@type": "Movie"
  name: string
  alternateName?: string
  description: string
  url: string
  mainEntityOfPage: string
  dateCreated?: string
  inLanguage?: string
  image?: string | string[]
  director?: PersonReference | PersonReference[]
  actor?: PersonReference | PersonReference[]
  productionCompany?: OrganizationReference | OrganizationReference[]
  sameAs?: string[]
}

export interface JsonLdPerson extends JsonLdBase {
  "@type": "Person"
  name: string
  alternateName?: string
  description: string
  url: string
  mainEntityOfPage: string
  image?: string
  birthDate?: string
  deathDate?: string
  sameAs?: string[]
}

export interface JsonLdItemList extends JsonLdBase {
  "@type": "ItemList"
  name: string
  url: string
  numberOfItems?: number
  itemListOrder: "https://schema.org/ItemListOrderAscending" | "https://schema.org/ItemListOrderDescending"
  itemListElement: Array<{
    "@type": "ListItem"
    position: number
    url: string
    item: ItemListEntity
  }>
}

export interface JsonLdCollectionPage extends JsonLdBase {
  "@type": "CollectionPage" | "SearchResultsPage"
  name: string
  description: string
  url: string
  inLanguage: string
  isPartOf: {
    "@type": "WebSite"
    name: string
    url: string
  }
  mainEntity?: JsonLdItemList
}

export function serializeJsonLd(schema: unknown) {
  return JSON.stringify(schema).replace(/</g, "\\u003c")
}

function cleanText(value?: string | null) {
  return value?.replace(/\s+/g, " ").trim() || ""
}

function firstSentence(value?: string | null) {
  const text = cleanText(value)
  if (!text) {
    return ""
  }

  const match = text.match(/^(.+?[.!؟…](?:\s|$))/)
  return cleanText(match?.[1] || text)
}

function truncateText(value: string, maxLength = 160) {
  if (value.length <= maxLength) {
    return value
  }

  const slice = value.slice(0, maxLength).trim()
  return `${slice.replace(/[\s،,؛-]+$/u, "")}…`
}

function summarizeText(value?: string | null, fallback = "") {
  const sentence = firstSentence(value)
  if (sentence) {
    return truncateText(sentence)
  }

  const cleanFallback = cleanText(fallback)
  return cleanFallback ? truncateText(cleanFallback) : fallback
}

function buildSameAs(
  options: { wikidataId?: string | null; imdbId?: string | null } | undefined,
  kind: "movie" | "person"
) {
  const sameAs = [
    options?.wikidataId ? `https://www.wikidata.org/wiki/${options.wikidataId}` : null,
    options?.imdbId ? `https://www.imdb.com/${kind === "person" ? "name" : "title"}/${options.imdbId}` : null,
  ].filter(Boolean) as string[]

  return sameAs.length > 0 ? sameAs : undefined
}

function mapPersonReference(person: { name_ar?: string | null; name_en?: string | null; slug?: string; id: string }) {
  return {
    "@type": "Person" as const,
    name: cleanText(person.name_ar || person.name_en || person.id),
    url: `${SITE_URL}/people/${person.slug || person.id}`,
  }
}

function mapOrganizationReference(company: { name_ar?: string; name_en?: string | null; slug?: string; id: string }) {
  return {
    "@type": "Organization" as const,
    name: cleanText(company.name_ar || company.name_en || company.id),
    url: `${SITE_URL}/companies/${company.slug || company.id}`,
  }
}

function buildMediaUrl(value?: string | null) {
  const cleanValue = cleanText(value)
  return cleanValue || undefined
}

function movieName(movie: Movie) {
  return cleanText(movie.title_ar || movie.title || movie.title_en || movie.id || "فيلم")
}

function personName(person: Person) {
  return cleanText(person.name_ar || person.name_en || person.full_name || person.id || "فنان")
}

function companyName(company: Company) {
  return cleanText(company.name_ar || company.name_en || company.id || "شركة سينمائية")
}

export function generateWebSiteSchema(): JsonLdWebSite {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    alternateName: "ElFilm",
    url: SITE_URL,
    inLanguage: "ar-EG",
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  }
}

export function generateOrganizationSchema(): JsonLdOrganization {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    alternateName: "ElFilm",
    url: SITE_URL,
    description: "أرشيف عربي أول للسينما المصرية، يجمع الأفلام والأسماء والشركات في واجهة قابلة للفهرسة والاكتشاف.",
    inLanguage: "ar-EG",
  }
}

export function generateCompanySchema(company: CompanyWithProductions): JsonLdOrganization {
  const name = companyName(company)
  const description = buildCompanyBlufSummary(company)
  const url = `${SITE_URL}/companies/${company.slug || company.id}`

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    alternateName: cleanText(company.name_en) || undefined,
    url,
    description,
    inLanguage: "ar-EG",
    foundingDate: company.founded_year ? String(company.founded_year) : undefined,
    dissolutionDate: company.closed_year ? String(company.closed_year) : undefined,
    location: cleanText(company.country) || undefined,
  }
}

export function generateBreadcrumbSchema(items: { name: string; url: string }[]): JsonLdBreadcrumbList {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: cleanText(item.name),
      item: item.url,
    })),
  }
}

export function generateMovieSchema(
  movie: MovieWithRelations,
  options?: { wikidataId?: string | null; imdbId?: string | null }
): JsonLdMovie {
  const title = cleanText(movie.title_ar || movie.title || movie.title_en || "فيلم")
  const alternateName = cleanText(movie.title_en || movie.title)
  const description = summarizeText(movie.summary_ar || movie.story, `فيلم مصري من عام ${movie.year}`)
  const url = `${SITE_URL}/movies/${movie.slug || movie.id}`
  const people = movie.people || []
  const directors = people.filter((person) => person.role_kind === "director")
  const actors = people.filter((person) => person.role_kind === "actor")
  const companies = movie.companies || []

  return {
    "@context": "https://schema.org",
    "@type": "Movie",
    name: title,
    alternateName: alternateName || undefined,
    description,
    url,
    mainEntityOfPage: url,
    dateCreated: movie.year ? String(movie.year) : undefined,
    inLanguage: "ar",
    image: buildMediaUrl(movie.poster_url || undefined),
    director: directors.length > 0 ? directors.map(mapPersonReference) : undefined,
    actor: actors.length > 0 ? actors.map(mapPersonReference) : undefined,
    productionCompany: companies.length > 0 ? companies.map(mapOrganizationReference) : undefined,
    sameAs: buildSameAs(options, "movie"),
  }
}

export function generatePersonSchema(
  person: PersonWithFilmography,
  options?: { wikidataId?: string | null; imdbId?: string | null }
): JsonLdPerson {
  const name = cleanText(person.name_ar || person.name_en || person.full_name || "فنان")
  const alternateName = cleanText(person.name_en || person.full_name)
  const description = summarizeText(person.bio_ar || person.bio, `فنان من السينما المصرية`)
  const url = `${SITE_URL}/people/${person.slug || person.id}`

  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name,
    alternateName: alternateName || undefined,
    description,
    url,
    mainEntityOfPage: url,
    image: buildMediaUrl(person.profile_image || undefined),
    birthDate: person.birthdate || undefined,
    deathDate: person.deathdate || undefined,
    sameAs: buildSameAs(options, "person"),
  }
}

export function generateItemListSchema(options: {
  name: string
  url: string
  items: Array<{
    type: ItemListEntityType
    name: string
    url: string
    image?: string | null
    description?: string | null
    dateCreated?: string | number | null
  }>
  startPosition?: number
  order?: JsonLdItemList["itemListOrder"]
}): JsonLdItemList {
  const startPosition = options.startPosition || 1

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: options.name,
    url: options.url,
    numberOfItems: options.items.length,
    itemListOrder: options.order || "https://schema.org/ItemListOrderAscending",
    itemListElement: options.items.map((item, index) => ({
      "@type": "ListItem",
      position: startPosition + index,
      url: item.url,
      item: {
        "@type": item.type,
        name: cleanText(item.name),
        url: item.url,
        image: buildMediaUrl(item.image || undefined),
        description: item.description ? summarizeText(item.description) : undefined,
        dateCreated: item.type === "Movie" && item.dateCreated ? String(item.dateCreated) : undefined,
        foundingDate: item.type === "Organization" && item.dateCreated ? String(item.dateCreated) : undefined,
      },
    })),
  }
}

export function generateCollectionPageSchema(options: {
  name: string
  description: string
  url: string
  mainEntity?: JsonLdItemList
  type?: JsonLdCollectionPage["@type"]
}): JsonLdCollectionPage {
  return {
    "@context": "https://schema.org",
    "@type": options.type || "CollectionPage",
    name: options.name,
    description: options.description,
    url: options.url,
    inLanguage: "ar-EG",
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
    },
    mainEntity: options.mainEntity,
  }
}

export function generateMovieItemList(movies: Movie[], options: { name: string; url: string; startPosition?: number }) {
  return generateItemListSchema({
    name: options.name,
    url: options.url,
    startPosition: options.startPosition,
    items: movies.map((movie) => ({
      type: "Movie",
      name: movieName(movie),
      url: `${SITE_URL}/movies/${movie.slug || movie.id}`,
      image: movie.poster_url,
      description: movie.summary_ar || movie.story,
      dateCreated: movie.year,
    })),
  })
}

export function generatePersonItemList(people: Person[], options: { name: string; url: string; startPosition?: number }) {
  return generateItemListSchema({
    name: options.name,
    url: options.url,
    startPosition: options.startPosition,
    items: people.map((person) => ({
      type: "Person",
      name: personName(person),
      url: `${SITE_URL}/people/${person.slug || person.id}`,
      image: person.profile_image,
      description: person.bio_ar || person.bio,
    })),
  })
}

export function generateCompanyItemList(
  companies: Company[],
  options: { name: string; url: string; startPosition?: number }
) {
  return generateItemListSchema({
    name: options.name,
    url: options.url,
    startPosition: options.startPosition,
    items: companies.map((company) => ({
      type: "Organization",
      name: companyName(company),
      url: `${SITE_URL}/companies/${company.slug || company.id}`,
      description: company.description_ar,
      dateCreated: company.founded_year,
    })),
  })
}

export function generateMovieMetadata(movie: MovieWithRelations): Metadata {
  const title = cleanText(movie.title_ar || movie.title || movie.title_en || "فيلم")
  const summary = summarizeText(movie.summary_ar || movie.story, `فيلم مصري من عام ${movie.year}`)
  const image = buildMediaUrl(movie.poster_url || undefined)

  return {
    title: {
      absolute: `${title} | ElFilm Archive`,
    },
    description: summary,
    openGraph: {
      title,
      description: summary,
      type: "video.movie",
      siteName: SITE_NAME,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description: summary,
      images: image ? [image] : undefined,
    },
  }
}

export function generatePersonMetadata(person: PersonWithFilmography): Metadata {
  const name = cleanText(person.name_ar || person.name_en || person.full_name || "فنان")
  const summary = summarizeText(person.bio_ar || person.bio, "فنان من السينما المصرية")
  const image = buildMediaUrl(person.profile_image || undefined)

  return {
    title: {
      absolute: `${name} | ElFilm Archive`,
    },
    description: summary,
    openGraph: {
      title: name,
      description: summary,
      type: "profile",
      siteName: SITE_NAME,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: name,
      description: summary,
      images: image ? [image] : undefined,
    },
  }
}

export function generateCompanyMetadata(company: CompanyWithProductions): Metadata {
  const name = companyName(company)
  const summary = buildCompanyBlufSummary(company)

  return {
    title: {
      absolute: `${name} | ElFilm Archive`,
    },
    description: summary,
    openGraph: {
      title: name,
      description: summary,
      type: "website",
      siteName: SITE_NAME,
    },
    twitter: {
      card: "summary",
      title: name,
      description: summary,
    },
  }
}

export function buildMovieBlufSummary(movie: MovieWithRelations) {
  return summarizeText(movie.summary_ar || movie.story, `فيلم مصري من عام ${movie.year}`)
}

export function buildPersonBlufSummary(person: PersonWithFilmography) {
  return summarizeText(person.bio_ar || person.bio, "فنان من السينما المصرية")
}

export function buildCompanyBlufSummary(company: CompanyWithProductions) {
  const productionCount = company.productions.length
  const fallbackParts = [
    "شركة سينمائية",
    company.country ? `من ${company.country}` : null,
    company.founded_year ? `تأسست عام ${company.founded_year}` : null,
    productionCount > 0 ? `مرتبطة بـ ${productionCount} عمل داخل أرشيف ElFilm` : "ضمن أرشيف ElFilm",
  ].filter(Boolean)

  return summarizeText(company.description_ar, `${fallbackParts.join("، ")}.`)
}
