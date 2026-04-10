"use client"

import * as React from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowLeft, Building2, Clapperboard, Search, Sparkles, UsersRound } from "lucide-react"

import { BornOnThisDay } from "@/components/features/born-on-this-day"
import { DiedOnThisDay } from "@/components/features/died-on-this-day"
import { HeroSection } from "@/components/features/hero-section"
import { MediaImage } from "@/components/features/media-image"
import { MovieCard } from "@/components/features/movie-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api, type Movie, type VectorSearchResult } from "@/lib/api"

const discovery = [
    { href: "/movies", label: "الأفلام", kicker: "كتالوج كامل حسب السنة والتصنيف", icon: Clapperboard },
    { href: "/people", label: "الفنانون", kicker: "وجوه وصناع خلف كل حقبة", icon: UsersRound },
    { href: "/companies", label: "الشركات", kicker: "إنتاج وتوزيع وبيوت سينما", icon: Building2 },
    { href: "/genres", label: "التصنيفات", kicker: "ادخل الأرشيف من المزاج أو الحقبة", icon: Sparkles },
]

const decades = ["1920", "1930", "1940", "1950", "1960", "1970", "1980", "1990", "2000", "2010", "2020"]

export default function HomePage() {
    const [searchResults, setSearchResults] = React.useState<VectorSearchResult[]>([])
    const [featuredMovies, setFeaturedMovies] = React.useState<Movie[]>([])
    const [isLoading, setIsLoading] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    React.useEffect(() => {
        const fetchFeatured = async () => {
            try {
                const { movies } = await api.listMovies({ limit: 36, orderBy: "rating", direction: "DESC" })
                setFeaturedMovies(movies.slice(0, 12))
            } catch (err) {
                console.error("Failed to fetch featured movies:", err)
            }
        }

        fetchFeatured()
    }, [])

    const handleSearch = async (query: string) => {
        setIsLoading(true)
        setError(null)
        try {
            const data = await api.vectorSearch(query, { limit: 12 })
            setSearchResults(data.results || [])
        } catch (err) {
            setError("تعذر تنفيذ البحث الآن. جرب مرة أخرى.")
            console.error("Search error:", err)
        } finally {
            setIsLoading(false)
        }
    }

    const spotlight = featuredMovies[0]
    const hasSearchState = isLoading || searchResults.length > 0 || error

    return (
        <div className="flex flex-col">
            <HeroSection
                title="ElFilm"
                subtitle="اكتشف الأفلام، الفنانين، الشركات، والسنوات التي صنعت صورة السينما المصرية."
                onSearch={handleSearch}
            />

            {hasSearchState && (
                <section className="container py-16">
                    <div className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
                        <div>
                            <Badge variant="outline" className="mb-3 gap-1 border-primary/35 bg-primary/10 text-primary">
                                <Search />
                                البحث الذكي
                            </Badge>
                            <h2 className="text-4xl font-bold">نتائج قريبة من ذاكرتك</h2>
                        </div>
                        {!isLoading && searchResults.length > 0 && (
                            <p className="text-sm text-muted-foreground">{searchResults.length} نتيجة</p>
                        )}
                    </div>

                    {error && (
                        <div className="rounded-lg border border-destructive bg-destructive/10 p-5 text-center text-destructive">
                            {error}
                        </div>
                    )}

                    {isLoading && (
                        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                            {Array.from({ length: 12 }).map((_, index) => (
                                <div key={index} className="flex flex-col gap-3">
                                    <Skeleton className="aspect-[2/3] rounded-lg" />
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-3 w-1/2" />
                                </div>
                            ))}
                        </div>
                    )}

                    {!isLoading && searchResults.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                            className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
                        >
                            {searchResults.map(({ movie }) => (
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
                        </motion.div>
                    )}

                    {!isLoading && searchResults.length === 0 && !error && (
                        <div className="rounded-lg border bg-card/50 p-10 text-center text-muted-foreground">
                            لا توجد نتائج مطابقة. جرب كلمة أخرى أو وصفا أقرب للفيلم.
                        </div>
                    )}
                </section>
            )}

            {!hasSearchState && (
                <>
                    <section className="container py-20">
                        <div className="grid overflow-hidden rounded-lg border bg-card/25 shadow-2xl shadow-black/20 lg:grid-cols-4">
                            {discovery.map(({ href, label, kicker, icon: Icon }) => (
                                <Link
                                    key={href}
                                    href={href}
                                    className="group flex min-h-52 flex-col justify-between border-b p-6 transition-colors hover:bg-primary hover:text-primary-foreground lg:border-b-0 lg:border-e"
                                >
                                    <div className="flex items-center justify-between">
                                        <Icon className="text-primary transition-colors group-hover:text-primary-foreground" />
                                        <ArrowLeft className="text-muted-foreground transition-transform group-hover:-translate-x-1 group-hover:text-primary-foreground" />
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-bold">{label}</h2>
                                        <p className="mt-3 text-sm leading-6 text-muted-foreground transition-colors group-hover:text-primary-foreground/75">{kicker}</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>

                    {spotlight && (
                        <section className="relative overflow-hidden border-y border-white/10">
                            {spotlight.poster_url && (
                                <MediaImage
                                    src={spotlight.poster_url}
                                    alt=""
                                    ariaHidden
                                    fill
                                    className="absolute inset-0 h-full w-full scale-110 object-cover opacity-20 blur-2xl"
                                    sizes="100vw"
                                    fallback={null}
                                />
                            )}
                            <div className="absolute inset-0 bg-background/88" />
                            <div className="container relative grid gap-10 py-20 lg:grid-cols-[1fr_420px] lg:items-end">
                                <div>
                                    <Badge variant="outline" className="mb-6 border-primary/35 bg-primary/10 text-primary">مختارات الأرشيف</Badge>
                                    <h2 className="max-w-4xl text-4xl font-bold leading-tight sm:text-5xl md:text-7xl">
                                        ابدأ من فيلم له ثقل، ثم اتبع الخيوط.
                                    </h2>
                                    <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
                                        أعلى الأفلام تقييما ليست نهاية التصفح؛ هي مدخل إلى ممثلين، شركات، سنوات، وتصنيفات متصلة.
                                    </p>
                                    <Button asChild size="lg" className="mt-8">
                                        <Link href="/movies">
                                            افتح الكتالوج
                                            <ArrowLeft data-icon="inline-end" />
                                        </Link>
                                    </Button>
                                </div>

                                <Link href={`/movies/${spotlight.slug || spotlight.id}`} className="group poster-surface poster-lift relative overflow-hidden rounded-lg border p-4 ring-1 ring-white/10 transition duration-300 hover:-translate-y-1 hover:ring-primary/45">
                                    {spotlight.poster_url ? (
                                        <MediaImage
                                            src={spotlight.poster_url}
                                            alt={spotlight.title || spotlight.title_ar || "فيلم"}
                                            width={420}
                                            height={630}
                                            className="aspect-[2/3] w-full rounded-md object-cover transition duration-500 group-hover:scale-[1.03]"
                                            fallback={<div className="aspect-[2/3] rounded-md bg-muted" />}
                                        />
                                    ) : (
                                        <div className="aspect-[2/3] rounded-md bg-muted" />
                                    )}
                                    <div className="absolute inset-x-4 bottom-4 bg-gradient-to-t from-black via-black/82 to-transparent p-5 pt-20 text-white">
                                        <p className="text-sm text-primary">{spotlight.year}</p>
                                        <h3 className="mt-1 text-3xl font-bold">{spotlight.title || spotlight.title_ar || spotlight.title_en}</h3>
                                    </div>
                                </Link>
                            </div>
                        </section>
                    )}

                    {featuredMovies.length > 1 && (
                        <section className="container py-20">
                            <div className="mb-10 flex items-end justify-between gap-4">
                                <div>
                                    <Badge variant="outline" className="mb-4 border-primary/35 bg-primary/10 text-primary">شريط العرض</Badge>
                                    <h2 className="text-4xl font-bold">أفلام تقودك إلى عمق الأرشيف</h2>
                                </div>
                                <Button asChild variant="ghost">
                                    <Link href="/movies">
                                        كل الأفلام
                                        <ArrowLeft data-icon="inline-end" />
                                    </Link>
                                </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                                {featuredMovies.slice(1).map((movie) => (
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
                        </section>
                    )}

                    <section className="container py-14">
                        <div className="overflow-hidden rounded-lg border bg-card/25 py-8 shadow-2xl shadow-black/10">
                            <div className="flex min-w-max gap-10 text-5xl font-bold text-muted-foreground/35">
                                {decades.map((decade) => (
                                    <Link key={decade} href={`/movies/year/${decade}`} className="rounded-md transition-colors hover:text-primary">
                                        {decade}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </section>

                    <section className="container grid gap-10 py-10 lg:grid-cols-2">
                        <BornOnThisDay />
                        <DiedOnThisDay />
                    </section>
                </>
            )}
        </div>
    )
}
