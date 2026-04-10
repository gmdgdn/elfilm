import Link from "next/link"

import { MovieCard } from "@/components/features/movie-card"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api"
import { generateCollectionPageSchema, generateMovieItemList, serializeJsonLd } from "@/lib/seo"

interface GenresPageProps {
    searchParams: Promise<{
        genreId?: string
        decade?: string
    }>
}

const decades = [2020, 2010, 2000, 1990, 1980, 1970, 1960, 1950, 1940, 1930, 1920]

export default async function GenresPage({ searchParams }: GenresPageProps) {
    const params = await searchParams
    const genreId = params.genreId ? parseInt(params.genreId) : undefined
    const decade = params.decade ? parseInt(params.decade) : undefined
    const [{ movies }, { genres }] = await Promise.all([
        api.listMovies({
            limit: 24,
            genreId,
            yearMin: decade,
            yearMax: decade ? decade + 9 : undefined,
            orderBy: "year",
            direction: "DESC",
        }),
        api.listGenres(),
    ])

    const makeHref = (next: { genreId?: number | null; decade?: number | null }) => {
        const query = new URLSearchParams()
        const finalGenre = next.genreId === undefined ? genreId : next.genreId
        const finalDecade = next.decade === undefined ? decade : next.decade
        if (finalGenre) query.set("genreId", String(finalGenre))
        if (finalDecade) query.set("decade", String(finalDecade))
        const qs = query.toString()
        return qs ? `/genres?${qs}` : "/genres"
    }
    const pageUrl = `https://film.gmd.gdn${makeHref({})}`
    const selectedGenre = genreId ? genres.find((genre) => genre.id === genreId)?.name_ar : null
    const pageName = [
        selectedGenre ? `أفلام ${selectedGenre}` : "التصنيفات والحقب",
        decade ? `عقد ${decade}` : null,
    ].filter(Boolean).join(" - ")
    const itemListSchema = generateMovieItemList(movies, {
        name: pageName,
        url: pageUrl,
    })
    const schemas = [
        generateCollectionPageSchema({
            name: pageName,
            description: "مدخل تصفح أفلام ElFilm حسب التصنيف أو العقد الزمني.",
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
                <Badge variant="outline" className="mb-4">خرائط التصفح</Badge>
                <h1 className="text-4xl font-bold">التصنيفات والحقب</h1>
                <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
                    ادخل إلى الأرشيف من النوع السينمائي أو من عقد زمني محدد.
                </p>
            </section>

            <section className="mb-10 flex flex-col gap-6">
                <div>
                    <h2 className="mb-3 text-sm font-semibold text-muted-foreground">التصنيف</h2>
                    <div className="flex flex-wrap gap-2">
                        <Badge asChild variant={!genreId ? "default" : "outline"} className="cursor-pointer">
                            <Link href={makeHref({ genreId: null })}>الكل</Link>
                        </Badge>
                        {genres.map((genre) => (
                            <Badge key={genre.id} asChild variant={genreId === genre.id ? "default" : "outline"} className="cursor-pointer">
                                <Link href={makeHref({ genreId: genre.id })}>{genre.name_ar}</Link>
                            </Badge>
                        ))}
                    </div>
                </div>

                <div>
                    <h2 className="mb-3 text-sm font-semibold text-muted-foreground">العقد</h2>
                    <div className="flex flex-wrap gap-2">
                        <Badge asChild variant={!decade ? "default" : "outline"} className="cursor-pointer">
                            <Link href={makeHref({ decade: null })}>كل السنوات</Link>
                        </Badge>
                        {decades.map((value) => (
                            <Badge key={value} asChild variant={decade === value ? "default" : "outline"} className="cursor-pointer">
                                <Link href={makeHref({ decade: value })}>{value}s</Link>
                            </Badge>
                        ))}
                    </div>
                </div>
            </section>

            {movies.length > 0 ? (
                <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
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
                    لا توجد أفلام مطابقة لهذه الاختيارات.
                </div>
            )}
        </div>
    )
}
