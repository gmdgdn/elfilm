import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ExternalLink, Newspaper, PlayCircle, Star, UserRound } from "lucide-react"

import { SimilarMoviesSection } from "@/components/features/similar-movies-section"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { api, type MovieWithRelations } from "@/lib/api"
import {
  buildMovieBlufSummary,
  generateBreadcrumbSchema,
  generateMovieMetadata,
  generateMovieSchema,
  serializeJsonLd,
} from "@/lib/seo"

interface MoviePageProps {
  params: Promise<{ slug: string }>
}

function formatArabicDate(value?: string | null) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("ar-EG")
}

function watchSourceLabel(value?: string | null) {
  switch (value) {
    case "exa":
      return "بحث Exa"
    case "youtube-search":
      return "بحث يوتيوب"
    case "manual":
      return "مصدر يدوي"
    default:
      return value || null
  }
}

function companyRoleLabel(value?: string | null) {
  switch (value) {
    case "production":
      return "إنتاج"
    case "distribution":
      return "توزيع"
    case "studio":
      return "استوديو"
    case "financing":
      return "تمويل"
    case "company":
      return "شركة"
    default:
      return value || null
  }
}

async function getMovie(slug: string): Promise<MovieWithRelations | null> {
  try {
    const data = await api.getMovie(slug)
    return data.movie
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: MoviePageProps): Promise<Metadata> {
  const { slug } = await params
  const movie = await getMovie(slug)

  if (!movie) {
    return {
      title: {
        absolute: "فيلم غير متاح | ElFilm Archive",
      },
      description: "صفحة الفيلم المطلوبة غير متاحة حاليا داخل أرشيف ElFilm.",
    }
  }

  return generateMovieMetadata(movie)
}

export default async function MoviePage({ params }: MoviePageProps) {
  const { slug } = await params
  const movie = await getMovie(slug)

  if (!movie) {
    notFound()
  }

  const movieTitle = movie.title || movie.title_ar || "فيلم"
  const blufSummary = buildMovieBlufSummary(movie)
  const people = movie.people || []
  const cast = people
    .filter((person) => person.role_kind === "actor")
    .sort((a, b) => (a.billing_order || 999) - (b.billing_order || 999))
  const directors = people.filter((person) => person.role_kind === "director")
  const writers = people.filter((person) => person.role_kind === "writer")
  const crew = people.filter((person) => !["actor", "director", "writer"].includes(person.role_kind))
  const watchLinks = movie.watch_links || []
  const articles = movie.news || []
  const newsItems = articles.filter((item) => item.category !== "review")
  const reviewItems = articles.filter((item) => item.category === "review")
  const genresList = typeof movie.genres === "string" && movie.genres
    ? movie.genres.split(",").map((genre, index) => ({ id: index, name_ar: genre.trim(), slug: genre.trim() }))
    : Array.isArray(movie.genres)
      ? movie.genres
      : []
  const url = `https://film.gmd.gdn/movies/${movie.slug || movie.id}`
  const schemas = [
    generateMovieSchema(movie),
    generateBreadcrumbSchema([
      { name: "الرئيسية", url: "https://film.gmd.gdn" },
      { name: "الأفلام", url: "https://film.gmd.gdn/movies" },
      { name: movieTitle, url },
    ]),
  ]

  return (
    <article className="pb-10">
      {schemas.map((schema) => (
        <script
          key={(schema as { "@type": string })["@type"]}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(schema),
          }}
        />
      ))}

      <section className="relative overflow-hidden border-b border-white/10">
        {movie.poster_url && (
          <Image
            src={movie.poster_url}
            alt=""
            aria-hidden="true"
            fill
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-20 blur-2xl"
            sizes="100vw"
            priority
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-background/52 via-background/90 to-background" />
        <div className="container relative grid gap-8 py-10 md:grid-cols-[300px_1fr] lg:gap-12">
          <div className="md:sticky md:top-24 md:self-start">
            <div className="poster-lift overflow-hidden rounded-lg border bg-card ring-1 ring-white/10">
              {movie.poster_url ? (
                <Image
                  src={movie.poster_url}
                  alt={movieTitle}
                  width={300}
                  height={450}
                  className="aspect-[2/3] w-full object-cover"
                  priority
                />
              ) : (
                <div className="flex aspect-[2/3] w-full items-center justify-center text-muted-foreground">
                  بدون ملصق
                </div>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-col justify-end">
            <div className="mb-5 flex flex-wrap gap-2">
              {movie.year && <Badge>{movie.year}</Badge>}
              {movie.duration && <Badge variant="outline">{movie.duration}</Badge>}
              {movie.duration_minutes && <Badge variant="outline">{movie.duration_minutes} دقيقة</Badge>}
              {movie.type && <Badge variant="outline">{movie.type}</Badge>}
              {movie.rating && (
                <Badge variant="secondary" className="gap-1">
                  <Star className="fill-primary text-primary" />
                  {movie.rating}
                </Badge>
              )}
            </div>

            <h1 className="text-4xl font-bold leading-tight md:text-6xl">{movieTitle}</h1>
            <p className="mt-4 max-w-3xl text-lg font-medium leading-8 text-muted-foreground">
              {blufSummary}
            </p>
            {movie.title_en && (
              <p className="mt-3 text-2xl text-muted-foreground">{movie.title_en}</p>
            )}

            {(movie.story || movie.summary_ar) && (
              <p className="mt-7 max-w-3xl text-lg leading-9 text-muted-foreground">
                {movie.story || movie.summary_ar}
              </p>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              {watchLinks.length > 0 ? (
                <Button asChild size="lg">
                  <Link href={`/watch/${movie.id}`}>
                    <PlayCircle data-icon="inline-start" />
                    شاهد الفيلم
                  </Link>
                </Button>
              ) : null}
              <Button asChild variant="outline" size="lg">
                <Link href="/movies">العودة للأفلام</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="container grid gap-10 py-12 lg:grid-cols-[1fr_320px]">
        <section className="flex flex-col gap-12">
          {cast.length > 0 && (
            <section>
              <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                  <Badge variant="outline" className="mb-3">طاقم التمثيل</Badge>
                  <h2 className="text-3xl font-bold">الأبطال</h2>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                {cast.slice(0, 12).map((person) => (
                  <Link key={person.id} href={`/people/${person.slug || person.id}`} className="group">
                    <Card className="overflow-hidden border-0 bg-transparent py-0 shadow-none">
                      <CardContent className="p-0">
                        <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted">
                          {person.profile_image ? (
                            <Image
                              src={person.profile_image}
                              alt={person.name_ar}
                              fill
                              className="object-cover transition duration-300 group-hover:scale-105"
                              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 18vw"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-muted-foreground">
                              <UserRound />
                            </div>
                          )}
                        </div>
                        <div className="pt-3">
                          <p className="line-clamp-1 font-semibold group-hover:text-primary">{person.name_ar}</p>
                          {person.role_credit && <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{person.role_credit}</p>}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {crew.length > 0 && (
            <section>
              <Badge variant="outline" className="mb-3">خلف الكاميرا</Badge>
              <h2 className="mb-6 text-3xl font-bold">طاقم العمل</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {crew.map((person) => (
                  <Link
                    key={`${person.id}-${person.role_kind}`}
                    href={`/people/${person.slug || person.id}`}
                    className="flex items-center justify-between rounded-lg border bg-card/45 p-4 transition-colors hover:bg-accent"
                  >
                    <span className="font-semibold">{person.name_ar}</span>
                    <span className="text-sm text-muted-foreground">{person.role_credit || person.role_kind}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {(watchLinks.length > 0 || articles.length > 0) && (
            <section className="grid gap-6 lg:grid-cols-2">
              {watchLinks.length > 0 && (
                <Card className="bg-card/55">
                  <CardContent className="p-6">
                    <Badge variant="outline" className="mb-3">المشاهدة</Badge>
                    <h2 className="mb-4 text-2xl font-bold">مصادر متاحة للمشاهدة</h2>
                    <div className="flex flex-wrap gap-3">
                      {watchLinks.slice(0, 4).map((link) => (
                        <div key={link.id || link.url} className="flex flex-col gap-2 rounded-lg border bg-background/40 p-3">
                          <Button asChild variant="outline">
                            <a href={link.url} target="_blank" rel="noopener noreferrer">
                              {link.platform}
                              <ExternalLink data-icon="inline-end" />
                            </a>
                          </Button>
                          <div className="flex flex-wrap gap-2">
                            {link.is_official ? <Badge variant="secondary">رسمي</Badge> : null}
                            {link.source_kind ? <Badge variant="outline">{watchSourceLabel(link.source_kind)}</Badge> : null}
                            {link.verified_at ? <Badge variant="outline">تحقق {formatArabicDate(link.verified_at)}</Badge> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button asChild className="mt-5">
                      <Link href={`/watch/${movie.id}`}>
                        افتح صفحة المشاهدة
                        <PlayCircle data-icon="inline-end" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              )}

              {articles.length > 0 && (
                <Card className="bg-card/55">
                  <CardContent className="p-6">
                    <Badge variant="outline" className="mb-3">روابط خارجية</Badge>
                    <h2 className="mb-4 text-2xl font-bold">مقالات وتغطيات</h2>
                    <div className="space-y-3">
                      {[...newsItems.slice(0, 2), ...reviewItems.slice(0, 2)].map((item, index) => (
                        <a
                          key={`${item.link}-${index}`}
                          href={item.link || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block rounded-lg border bg-background/50 p-4 transition-colors hover:bg-accent"
                        >
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Newspaper className="h-4 w-4" />
                            <span>{item.category === "review" ? "مراجعة" : "مقال"}</span>
                            {item.domain ? <span>{item.domain}</span> : null}
                            {item.published_at ? <span>{formatArabicDate(item.published_at)}</span> : null}
                          </div>
                          <p className="mt-2 font-semibold">{item.title || "رابط خارجي"}</p>
                          {item.snippet ? <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.snippet}</p> : null}
                        </a>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </section>
          )}

          <SimilarMoviesSection slug={slug} year={typeof movie.year === "string" ? parseInt(movie.year) : movie.year} genres={genresList} />
        </section>

        <aside className="flex flex-col gap-6">
          <Card className="bg-card/55">
            <CardContent className="flex flex-col gap-5 p-6">
              <h2 className="text-xl font-bold">بيانات الفيلم</h2>
              {genresList.length > 0 && (
                <div>
                  <p className="mb-2 text-sm text-muted-foreground">التصنيف</p>
                  <div className="flex flex-wrap gap-2">
                    {genresList.map((genre) => (
                      <Badge key={genre.id} variant="secondary">{genre.name_ar}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {directors.length > 0 && (
                <div>
                  <p className="mb-2 text-sm text-muted-foreground">الإخراج</p>
                  <div className="flex flex-wrap gap-2">
                    {directors.map((director) => (
                      <Link key={director.id} href={`/people/${director.slug || director.id}`} className="font-semibold hover:text-primary">
                        {director.name_ar}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {writers.length > 0 && (
                <div>
                  <p className="mb-2 text-sm text-muted-foreground">الكتابة</p>
                  <div className="flex flex-col gap-2">
                    {writers.map((writer) => (
                      <Link key={writer.id} href={`/people/${writer.slug || writer.id}`} className="font-semibold hover:text-primary">
                        {writer.name_ar}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {watchLinks.length > 0 && (
                <div>
                  <p className="mb-2 text-sm text-muted-foreground">المشاهدة</p>
                  <div className="flex flex-wrap gap-2">
                    {watchLinks.slice(0, 4).map((link) => (
                      <Badge key={link.id || link.url} variant="secondary">{link.platform}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {(movie.companies || []).length > 0 && (
                <div>
                  <p className="mb-2 text-sm text-muted-foreground">الإنتاج</p>
                  <div className="flex flex-col gap-2">
                    {(movie.companies || []).map((company) => (
                      <div key={company.id} className="flex items-center justify-between gap-3">
                        <Link href={`/companies/${company.slug || company.id}`} className="font-semibold hover:text-primary">
                          {company.name_ar}
                        </Link>
                        {company.role_kind ? (
                          <Badge variant="outline">{companyRoleLabel(company.role_kind)}</Badge>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {(movie.tags || []).length > 0 && (
            <Card className="bg-card/55">
              <CardContent className="p-6">
                <h2 className="mb-4 text-xl font-bold">الوسوم</h2>
                <div className="flex flex-wrap gap-2">
                  {(movie.tags || []).map((tag) => (
                    <Badge key={tag.id} variant="outline">{tag.name_ar}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </article>
  )
}
