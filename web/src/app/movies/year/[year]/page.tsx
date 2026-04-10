import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { FiltersSidebar } from "@/components/features/filters-sidebar"
import { MovieCard } from "@/components/features/movie-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { generateCollectionPageSchema, generateMovieItemList, serializeJsonLd } from "@/lib/seo"

interface MoviesByYearPageProps {
    params: Promise<{ year: string }>
    searchParams: Promise<{
        page?: string
        orderBy?: string
        direction?: string
        genreId?: string
    }>
}

const genres = [
    { id: 1, name: "دراما" },
    { id: 2, name: "كوميدي" },
    { id: 3, name: "أكشن" },
    { id: 4, name: "رومانسي" },
    { id: 5, name: "تاريخي" },
]

const movieOrderBy = ["year", "title", "rating"] as const
const directions = ["ASC", "DESC"] as const

function parseMovieOrderBy(value?: string): (typeof movieOrderBy)[number] {
    return movieOrderBy.includes(value as (typeof movieOrderBy)[number]) ? value as (typeof movieOrderBy)[number] : "title"
}

function parseDirection(value?: string): (typeof directions)[number] {
    return directions.includes(value as (typeof directions)[number]) ? value as (typeof directions)[number] : "ASC"
}

export default async function MoviesByYearPage({ params, searchParams }: MoviesByYearPageProps) {
    const { year } = await params
    const searchParamsValues = await searchParams
    const targetYear = parseInt(year)

    if (Number.isNaN(targetYear) || targetYear < 1900 || targetYear > 2030) {
        return (
            <div className="container py-20 text-center">
                <h1 className="text-3xl font-bold">سنة غير صالحة</h1>
                <p className="mt-4 text-muted-foreground">يرجى التحقق من السنة المطلوبة.</p>
                <Button asChild className="mt-6">
                    <Link href="/movies">العودة للأفلام</Link>
                </Button>
            </div>
        )
    }

    const currentPage = Math.max(parseInt(searchParamsValues.page || "1"), 1)
    const limit = 24
    const offset = (currentPage - 1) * limit
    const { movies, count } = await api.listMovies({
        limit,
        offset,
        orderBy: parseMovieOrderBy(searchParamsValues.orderBy),
        direction: parseDirection(searchParamsValues.direction),
        yearMin: targetYear,
        yearMax: targetYear,
        genreId: searchParamsValues.genreId ? parseInt(searchParamsValues.genreId) : undefined,
    })
    const totalPages = Math.max(Math.ceil(count / limit), 1)
    const pageUrl = currentPage > 1
        ? `https://film.gmd.gdn/movies/year/${targetYear}?page=${currentPage}`
        : `https://film.gmd.gdn/movies/year/${targetYear}`
    const itemListSchema = generateMovieItemList(movies, {
        name: `أفلام عام ${targetYear}`,
        url: pageUrl,
        startPosition: offset + 1,
    })
    const schemas = [
        generateCollectionPageSchema({
            name: `أفلام عام ${targetYear}`,
            description: `قائمة أفلام السينما المصرية المسجلة في أرشيف ElFilm لعام ${targetYear}.`,
            url: pageUrl,
            mainEntity: itemListSchema,
        }),
    ]

    return (
        <div className="container py-10">
            {schemas.map((schema) => (
                <script
                    key={(schema as { "@type": string })["@type"]}
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: serializeJsonLd(schema),
                    }}
                />
            ))}

            <section className="mb-10 rounded-lg border bg-card/45 p-6 md:p-8">
                <Badge variant="outline" className="mb-4">سنة الإنتاج</Badge>
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-bold">أفلام عام {year}</h1>
                        <p className="mt-3 leading-7 text-muted-foreground">كل الأعمال المسجلة في الأرشيف لهذه السنة.</p>
                    </div>
                    <div className="text-2xl font-bold text-primary">{count.toLocaleString("ar-EG")} فيلم</div>
                </div>
            </section>

            <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
                <aside className="hidden lg:block">
                    <div className="sticky top-24">
                        <FiltersSidebar type="movies" genres={genres} />
                    </div>
                </aside>

                <div className="flex flex-col gap-8">
                    {movies.length > 0 ? (
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
                    ) : (
                        <div className="rounded-lg border bg-card/50 p-10 text-center text-muted-foreground">
                            لا توجد أفلام في هذه السنة.
                        </div>
                    )}

                    {totalPages > 1 && (
                        <div className="flex flex-wrap items-center justify-center gap-3">
                            <Button variant="outline" disabled={currentPage <= 1} asChild={currentPage > 1}>
                                {currentPage > 1 ? (
                                    <Link href={`/movies/year/${year}?page=${currentPage - 1}`}>
                                        <ChevronRight />
                                        السابق
                                    </Link>
                                ) : (
                                    <span><ChevronRight />السابق</span>
                                )}
                            </Button>

                            <div className="rounded-md border bg-card px-4 py-2 text-sm font-medium">
                                صفحة {currentPage.toLocaleString("ar-EG")} من {totalPages.toLocaleString("ar-EG")}
                            </div>

                            <Button variant="outline" disabled={currentPage >= totalPages} asChild={currentPage < totalPages}>
                                {currentPage < totalPages ? (
                                    <Link href={`/movies/year/${year}?page=${currentPage + 1}`}>
                                        التالي
                                        <ChevronLeft />
                                    </Link>
                                ) : (
                                    <span>التالي<ChevronLeft /></span>
                                )}
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
