import type { ArchiveCompanyDetail, ArchiveMovieDetail, ArchivePersonDetail } from "./archive";

const siteUrl = "https://elfilm.net";

export function absoluteUrl(pathname: string) {
  return new URL(pathname, siteUrl).toString();
}

export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function movieSchema(movie: ArchiveMovieDetail) {
  const title = movie.title_ar || movie.title || movie.title_en || "Untitled";

  return {
    "@context": "https://schema.org",
    "@type": "Movie",
    name: title,
    dateCreated: movie.year ? String(movie.year) : undefined,
    inLanguage: movie.language || "ar",
    countryOfOrigin: movie.country || "Egypt",
    description: movie.summary_ar || movie.story || undefined,
    image: movie.poster_url || undefined,
    actor: movie.people
      .filter((person) => person.role_kind === "actor")
      .slice(0, 10)
      .map((person) => ({
        "@type": "Person",
        name: person.name_ar || person.name_en || "Unknown",
      })),
    director: movie.people
      .filter((person) => person.role_kind === "director")
      .slice(0, 5)
      .map((person) => ({
        "@type": "Person",
        name: person.name_ar || person.name_en || "Unknown",
      })),
  };
}

export function personSchema(person: ArchivePersonDetail) {
  const name = person.name_ar || person.name_en || "Unknown";

  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name,
    description: person.bio_ar || undefined,
    image: person.profile_image || undefined,
    nationality: person.country || "Egyptian",
    birthDate: person.birthdate || undefined,
    deathDate: person.deathdate || undefined,
  };
}

export function companySchema(company: ArchiveCompanyDetail) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: company.name_ar,
    alternateName: company.name_en || undefined,
    description: company.description_ar || undefined,
    foundingDate: company.founded_year ? String(company.founded_year) : undefined,
    dissolutionDate: company.closed_year ? String(company.closed_year) : undefined,
    location: company.country || "Egypt",
  };
}
