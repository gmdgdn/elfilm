import Link from "next/link"
import { ArrowLeft, Search, Sparkles } from "lucide-react"

import { MediaImage } from "@/components/features/media-image"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"
import { generateCollectionPageSchema, generateMovieItemList, serializeJsonLd } from "@/lib/seo"

export const dynamic = "force-dynamic"

export const metadata = {
    title: "البحث",
    description: "ابحث في أرشيف السينما المصرية بالوصف، الذاكرة، الحقبة، أو اسم الفيلم.",
}

interface SearchPageProps {
    searchParams: Promise<{
        q?: string
        yearMin?: string
        yearMax?: string
    }>
}

function parseYear(value?: string) {
    if (!value) {
        return undefined
    }

    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) ? parsed : undefined
}

function getSourceLabel(source?: "hybrid" | "vector" | "keyword") {
    switch (source) {
        case "hybrid":
            return "ترتيب هجين"
        case "vector":
            return "مطابقة دلالية"
        default:
            return "مطابقة نصية"
    }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
    const params = await searchParams
    const query = params.q?.trim() || ""
    const yearMin = parseYear(params.yearMin)
    const yearMax = parseYear(params.yearMax)
    const response = query
        ? await api.vectorSearch(query, {
            yearMin,
            yearMax,
            limit: 18,
        })
        : null
    const results = response?.results || []
    const resultMovies = results.map((result) => result.movie)
    const queryString = query ? `?${new URLSearchParams({ q: query }).toString()}` : ""
    const pageUrl = `https://film.gmd.gdn/search${queryString}`
    const itemListSchema = query
        ? generateMovieItemList(resultMovies, {
            name: `نتائج البحث عن ${query}`,
            url: pageUrl,
        })
        : null
    const schemas = [
        generateCollectionPageSchema({
            name: query ? `نتائج البحث عن ${query}` : "البحث في ElFilm",
            description: "صفحة البحث في أرشيف ElFilm للأفلام وصناع السينما المصرية.",
            url: pageUrl,
            mainEntity: itemListSchema || undefined,
            type: "SearchResultsPage",
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

            <section className="index-masthead relative overflow-hidden border-b border-white/10">
                <div className="absolute inset-0 hairline-grid opacity-40" />
                <div className="container relative py-16 md:py-24">
                    <Badge variant="outline" className="mb-4 border-white/25 bg-black/30 text-white">
                        <Sparkles />
                        البحث الذكي
                    </Badge>
                    <div className="max-w-4xl text-white">
                        <h1 className="text-4xl font-bold leading-tight sm:text-5xl md:text-7xl">
                            ابحث في الأرشيف كما تتذكره
                        </h1>
                        <p className="mt-5 max-w-3xl text-lg leading-8 text-white/72">
                            اكتب عنوانا، ممثلا، حقبة، أو حتى وصفا لمشهد عالق في الذاكرة. الواجهة الحالية تبقى كما هي،
                            لكن هذه الصفحة تمنح البحث عنوانا مستقلا وروابط قابلة للمشاركة.
                        </p>
                    </div>

                    <form action="/search" method="get" className="mt-10 grid gap-3 rounded-lg border border-white/15 bg-black/40 p-4 shadow-2xl shadow-black/20 md:grid-cols-[minmax(0,1.6fr)_160px_160px_auto]">
                        <div className="relative md:col-auto">
                            <Search className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-primary" />
                            <Input
                                type="search"
                                name="q"
                                defaultValue={query}
                                placeholder="فيلم من الستينيات عن قاعة محكمة أو صراع سياسي"
                                aria-label="ابحث في الأرشيف"
                                className="h-12 border-white/15 bg-white/5 pe-4 ps-10 text-base text-white placeholder:text-white/45"
                            />
                        </div>
                        <Input
                            type="number"
                            name="yearMin"
                            min={1900}
                            max={2030}
                            defaultValue={yearMin ?? ""}
                            placeholder="من سنة"
                            className="h-12 border-white/15 bg-white/5 text-white placeholder:text-white/45"
                        />
                        <Input
                            type="number"
                            name="yearMax"
                            min={1900}
                            max={2030}
                            defaultValue={yearMax ?? ""}
                            placeholder="إلى سنة"
                            className="h-12 border-white/15 bg-white/5 text-white placeholder:text-white/45"
                        />
                        <Button type="submit" size="lg" className="h-12">
                            ابدأ البحث
                            <ArrowLeft data-icon="inline-end" />
                        </Button>
                    </form>
                </div>
            </section>

            <section className="container py-12">
                <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-bold">
                            {query ? `نتائج البحث عن “${query}”` : "ابدأ من استعلام واضح أو من وصف حر"}
                        </h2>
                        <p className="mt-3 text-muted-foreground">
                            {query
                                ? `${results.length.toLocaleString("ar-EG")} نتيجة`
                                : "جرّب: نجيب محفوظ، فاتن حمامة، فيلم أبيض وأسود، أو وصف مشهد تتذكره."}
                        </p>
                    </div>
                    {response?.fallback && (
                        <Badge variant="secondary">تم استخدام المطابقة النصية كخطة بديلة</Badge>
                    )}
                </div>

                {response?.warning && (
                    <Card className="mb-6 border-amber-500/30 bg-amber-500/10">
                        <CardContent className="py-4 text-sm leading-7 text-amber-100">
                            {response.warning}
                        </CardContent>
                    </Card>
                )}

                {!query && (
                    <Card className="border-white/10 bg-card/40">
                        <CardContent className="flex flex-col gap-5 py-10 text-center">
                            <p className="text-lg font-medium">البحث هنا مصمم للوصف، لا للعناوين فقط.</p>
                            <div className="flex flex-wrap justify-center gap-3">
                                {[
                                    "أفلام الجريمة في الستينيات",
                                    "فيلم مع محكمة وصراع سياسي",
                                    "نجيب محفوظ",
                                    "راقصة ومطرب في فيلم أبيض وأسود",
                                ].map((suggestion) => (
                                    <Button key={suggestion} variant="outline" asChild>
                                        <Link href={`/search?q=${encodeURIComponent(suggestion)}`}>{suggestion}</Link>
                                    </Button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {query && results.length === 0 && (
                    <Card className="border-white/10 bg-card/40">
                        <CardContent className="py-10 text-center text-muted-foreground">
                            لا توجد نتائج مطابقة الآن. حاول اسما أقصر، ممثلا رئيسيا، أو نطاقا زمنيا أوسع.
                        </CardContent>
                    </Card>
                )}

                {results.length > 0 && (
                    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                        {results.map((result) => {
                            const movie = result.movie
                            const title = movie.title || movie.title_ar || movie.title_en || "Untitled"
                            const similarity = typeof result.similarity === "number"
                                ? `${Math.round(result.similarity * 100)}%`
                                : null

                            return (
                                <Link key={`${movie.id}-${result.source || "search"}`} href={`/movies/${movie.slug || movie.id}`} className="group">
                                    <Card className="h-full overflow-hidden border-white/10 bg-card/55 transition-colors hover:bg-card/80">
                                        <CardContent className="flex h-full gap-4 p-4">
                                            <div className="relative w-28 shrink-0 overflow-hidden rounded-md bg-muted ring-1 ring-white/10">
                                                {movie.poster_url ? (
                                                    <MediaImage
                                                        src={movie.poster_url}
                                                        alt={title}
                                                        fill
                                                        className="object-cover transition duration-500 group-hover:scale-105"
                                                        sizes="112px"
                                                        fallback={
                                                            <div className="poster-surface flex h-full items-center justify-center text-center text-xs text-muted-foreground">
                                                                الملصق غير متاح
                                                            </div>
                                                        }
                                                    />
                                                ) : (
                                                    <div className="poster-surface flex h-full items-center justify-center text-center text-xs text-muted-foreground">
                                                        بدون ملصق
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex min-w-0 flex-1 flex-col">
                                                <div className="flex flex-wrap gap-2">
                                                    <Badge variant="secondary">{getSourceLabel(result.source)}</Badge>
                                                    {similarity && <Badge variant="outline">{similarity}</Badge>}
                                                    {movie.year && <Badge variant="outline">{movie.year}</Badge>}
                                                </div>
                                                <h3 className="mt-3 line-clamp-2 text-xl font-bold transition-colors group-hover:text-primary">
                                                    {title}
                                                </h3>
                                                <p className="mt-3 line-clamp-4 text-sm leading-7 text-muted-foreground">
                                                    {movie.summary_ar || movie.story || "تفاصيل هذا العمل متاحة داخل صفحة الفيلم."}
                                                </p>
                                                <span className="mt-auto pt-4 text-sm font-medium text-primary">
                                                    افتح صفحة الفيلم
                                                </span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            )
                        })}
                    </div>
                )}
            </section>
        </div>
    )
}
