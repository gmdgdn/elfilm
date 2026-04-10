import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ExternalLink } from "lucide-react"

import { RankedMovieCard } from "@/components/features/ranked-movie-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { api, type CuratedMovieList } from "@/lib/api"
import {
    generateCollectionPageSchema,
    generateItemListSchema,
    serializeJsonLd,
    SITE_URL,
} from "@/lib/seo"

interface MovieListPageProps {
    params: Promise<{ slug: string }>
}

async function getMovieList(slug: string): Promise<CuratedMovieList | null> {
    try {
        const data = await api.getMovieList(slug)
        return data.list
    } catch {
        return null
    }
}

export async function generateMetadata({ params }: MovieListPageProps): Promise<Metadata> {
    const { slug } = await params
    const list = await getMovieList(slug)

    if (!list) {
        return {
            title: {
                absolute: "قائمة أفلام غير متاحة | ElFilm Archive",
            },
            description: "قائمة الأفلام المطلوبة غير متاحة حاليا داخل أرشيف ElFilm.",
        }
    }

    return {
        title: {
            absolute: `${list.title_ar} | ElFilm Archive`,
        },
        description: list.description_ar,
        alternates: {
            canonical: `/movies/lists/${list.slug}`,
        },
        openGraph: {
            title: list.title_ar,
            description: list.description_ar,
            type: "website",
            siteName: "ElFilm Archive",
        },
        twitter: {
            card: "summary",
            title: list.title_ar,
            description: list.description_ar,
        },
    }
}

export default async function MovieListPage({ params }: MovieListPageProps) {
    const { slug } = await params
    const list = await getMovieList(slug)

    if (!list) {
        notFound()
    }

    const pageUrl = `${SITE_URL}/movies/lists/${list.slug}`
    const matchedPercent = Math.round((list.matched_count / Math.max(list.count, 1)) * 100)
    const itemListSchema = generateItemListSchema({
        name: list.title_ar,
        url: pageUrl,
        items: list.entries.map((entry) => ({
            type: "Movie",
            name: entry.movie?.title_ar || entry.movie?.title || entry.title_ar,
            url: entry.movie
                ? `${SITE_URL}/movies/${entry.movie.slug || entry.movie.id}`
                : `${pageUrl}#rank-${entry.rank}`,
            image: entry.movie?.poster_url,
            dateCreated: entry.year,
        })),
    })
    const schemas = [
        generateCollectionPageSchema({
            name: list.title_ar,
            description: list.description_ar,
            url: pageUrl,
            mainEntity: itemListSchema,
        }),
    ]

    return (
        <div className="pb-14">
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
                <div className="container relative py-14 md:py-20">
                    <div className="max-w-4xl text-white">
                        <Badge variant="outline" className="mb-4 border-white/25 bg-black/30 text-white">
                            قوائم ElFilm
                        </Badge>
                        <h1 className="text-4xl font-bold leading-tight sm:text-5xl md:text-7xl">
                            {list.title_ar}
                        </h1>
                        <p className="mt-5 max-w-3xl text-lg leading-8 text-white/72">
                            {list.description_ar}
                        </p>
                    </div>

                    <div className="mt-8 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-lg border border-white/15 bg-black/35 p-4 text-white">
                            <p className="text-3xl font-bold">{list.count.toLocaleString("ar-EG")}</p>
                            <p className="mt-1 text-sm text-white/65">فيلم في القائمة</p>
                        </div>
                        <div className="rounded-lg border border-white/15 bg-black/35 p-4 text-white">
                            <p className="text-3xl font-bold">{list.matched_count.toLocaleString("ar-EG")}</p>
                            <p className="mt-1 text-sm text-white/65">مرتبط بصفحات ElFilm</p>
                        </div>
                        <div className="rounded-lg border border-white/15 bg-black/35 p-4 text-white">
                            <p className="text-3xl font-bold">%{matchedPercent.toLocaleString("ar-EG")}</p>
                            <p className="mt-1 text-sm text-white/65">تغطية داخل الأرشيف</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="container py-10">
                <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <Badge variant="outline" className="mb-3">الترتيب الكامل</Badge>
                        <h2 className="text-3xl font-bold">من العزيمة إلى الزوجة ١٣</h2>
                        <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">
                            الترتيب محفوظ كما ورد في القائمة الأصلية. البطاقات غير المربوطة تبقى ظاهرة حتى تظل القائمة كاملة.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline">
                            <Link href="/movies">تصفح كل الأفلام</Link>
                        </Button>
                        <Button asChild variant="secondary">
                            <a href={list.source_url} target="_blank" rel="noopener noreferrer">
                                المصدر
                                <ExternalLink data-icon="inline-end" />
                            </a>
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
                    {list.entries.map((entry) => (
                        <RankedMovieCard
                            key={entry.rank}
                            rank={entry.rank}
                            id={entry.movie?.id}
                            slug={entry.movie?.slug}
                            title={entry.movie?.title_ar || entry.movie?.title || entry.title_ar}
                            year={entry.year}
                            director={entry.director}
                            posterUrl={entry.movie?.poster_url}
                            rating={entry.movie?.rating}
                        />
                    ))}
                </div>

                <p className="mt-8 max-w-4xl text-sm leading-7 text-muted-foreground">
                    مصدر الترتيب: {list.source_name}. ظهرت القائمة ضمن استفتاء نقاد السينما المصرية في مئوية السينما المصرية، ثم ربطها ElFilm ببيانات الأرشيف حيثما توفرت.
                </p>
            </section>
        </div>
    )
}
