import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { FiltersSidebar } from "@/components/features/filters-sidebar"
import { MovieCard } from "@/components/features/movie-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { generateCollectionPageSchema, generateMovieItemList, serializeJsonLd } from "@/lib/seo"

interface BrowseMoviesPageProps {
    searchParams: Promise<{
        page?: string
        orderBy?: string
        direction?: string
        yearMin?: string
        yearMax?: string
        genreId?: string
    }>
}

const movieOrderBy = ["year", "title", "rating"] as const
const directions = ["ASC", "DESC"] as const

function parseMovieOrderBy(value?: string): (typeof movieOrderBy)[number] {
    return movieOrderBy.includes(value as (typeof movieOrderBy)[number]) ? value as (typeof movieOrderBy)[number] : "year"
}

function parseDirection(value?: string): (typeof directions)[number] {
    return directions.includes(value as (typeof directions)[number]) ? value as (typeof directions)[number] : "DESC"
}

export default async function BrowseMoviesPage({ searchParams }: BrowseMoviesPageProps) {
    const params = await searchParams
    const currentPage = Math.max(parseInt(params.page || "1"), 1)
    const limit = 24
    const offset = (currentPage - 1) * limit

    const [{ movies, count }, { genres }] = await Promise.all([
        api.listMovies({
            limit,
            offset,
            orderBy: parseMovieOrderBy(params.orderBy),
            direction: parseDirection(params.direction),
            yearMin: params.yearMin ? parseInt(params.yearMin) : undefined,
            yearMax: params.yearMax ? parseInt(params.yearMax) : undefined,
            genreId: params.genreId ? parseInt(params.genreId) : undefined,
        }),
        api.listGenres(),
    ])

    const totalPages = Math.max(Math.ceil(count / limit), 1)
    const pageUrl = currentPage > 1 ? `https://film.gmd.gdn/movies?page=${currentPage}` : "https://film.gmd.gdn/movies"
    const itemListSchema = generateMovieItemList(movies, {
        name: "أفلام ElFilm",
        url: pageUrl,
        startPosition: offset + 1,
    })
    const schemas = [
        generateCollectionPageSchema({
            name: "تصفح الأفلام",
            description: "كتالوج أفلام السينما المصرية داخل أرشيف ElFilm.",
            url: pageUrl,
            mainEntity: itemListSchema,
        }),
    ]

    return (
        <div>
            {schemas.map((schema) => (
                <script
                    key={(schema as { "@type": string })["@type"]}
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: serializeJsonLd(schema),
                    }}
                />
            ))}

            <section className="index-masthead relative mb-12 overflow-hidden border-b border-white/10">
                <div className="absolute inset-0 hairline-grid opacity-40" />
                <div className="container relative py-16 md:py-24">
                    <Badge variant="outline" className="mb-4 border-white/25 bg-black/30 text-white">كتالوج الأفلام</Badge>
                    <div className="flex flex-wrap items-end justify-between gap-6">
                        <div className="max-w-3xl text-white">
                            <h1 className="text-4xl font-bold leading-tight sm:text-5xl md:text-7xl">تصفح الأفلام</h1>
                            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/72">
                                اختر الفترة الزمنية، التصنيف، أو طريقة الترتيب؛ كل نتيجة تفتح خيطا جديدا في الأرشيف.
                            </p>
                        </div>
                        <div className="flex flex-col items-start gap-3">
                            <div className="rounded-lg border border-white/15 bg-black/35 px-5 py-4 text-4xl font-bold text-primary shadow-2xl shadow-black/20">
                                {count.toLocaleString("ar-EG")} فيلم
                            </div>
                            <Button asChild variant="secondary">
                                <Link href="/movies/lists/top-100-egyptian-movies">
                                    أفضل 100 فيلم مصري
                                </Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </section>

            <div className="container grid gap-10 lg:grid-cols-[280px_1fr]">
                <aside className="hidden lg:block">
                    <div className="sticky top-24">
                        <FiltersSidebar type="movies" genres={genres.map((genre) => ({ id: genre.id, name: genre.name_ar }))} />
                    </div>
                </aside>

                <div className="flex flex-col gap-8">
                    <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                        {movies.map((movie) => (
                            <MovieCard
                                key={movie.id}
                                id={movie.id}
                                slug={movie.slug || movie.id}
                                title={movie.title || movie.title_ar || movie.title_en || "Untitled"}
                                year={movie.year}
                                posterUrl={movie.poster_url}
                                rating={movie.rating}
                            />
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <Button variant="outline" disabled={currentPage <= 1} asChild={currentPage > 1}>
                            {currentPage > 1 ? (
                                <Link href={`/movies?page=${currentPage - 1}`}>
                                    <ChevronRight data-icon="inline-start" />
                                    السابق
                                </Link>
                            ) : (
                                <span>
                                    <ChevronRight data-icon="inline-start" />
                                    السابق
                                </span>
                            )}
                        </Button>

                        <div className="rounded-md border bg-card px-4 py-2 text-sm font-medium">
                            صفحة {currentPage.toLocaleString("ar-EG")} من {totalPages.toLocaleString("ar-EG")}
                        </div>

                        <Button variant="outline" disabled={currentPage >= totalPages} asChild={currentPage < totalPages}>
                            {currentPage < totalPages ? (
                                <Link href={`/movies?page=${currentPage + 1}`}>
                                    التالي
                                    <ChevronLeft data-icon="inline-end" />
                                </Link>
                            ) : (
                                <span>
                                    التالي
                                    <ChevronLeft data-icon="inline-end" />
                                </span>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
