import Link from "next/link"
import { ArrowLeft, CalendarDays, Clapperboard, Sparkles, UserRound } from "lucide-react"

import { MovieCard } from "@/components/features/movie-card"
import { PersonCard } from "@/components/features/person-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/api"
import { generateCollectionPageSchema, generateItemListSchema, serializeJsonLd } from "@/lib/seo"

export const dynamic = "force-dynamic"

export const metadata = {
    title: "في مثل هذا اليوم",
    description: "مواليد ووفيات وعروض أولى مرتبطة بتاريخ اليوم داخل أرشيف السينما المصرية.",
}

function formatTodayLabel(date: Date) {
    return new Intl.DateTimeFormat("ar-EG", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    }).format(date)
}

export default async function OnThisDayPage() {
    const today = new Date()
    const payload = await api.getOnThisDay(today.getMonth() + 1, today.getDate(), 12)
    const pageUrl = "https://film.gmd.gdn/on-this-day"
    const pageTitle = "حدث في مثل هذا اليوم"
    const itemListSchema = generateItemListSchema({
        name: pageTitle,
        url: pageUrl,
        items: [
            ...payload.born.people.map((person) => ({
                type: "Person" as const,
                name: person.name_ar || person.name_en || person.id,
                url: `https://film.gmd.gdn/people/${person.slug || person.id}`,
                image: person.profile_image,
                description: person.birthdate ? `مواليد ${person.birthdate}` : undefined,
            })),
            ...payload.died.people.map((person) => ({
                type: "Person" as const,
                name: person.name_ar || person.name_en || person.id,
                url: `https://film.gmd.gdn/people/${person.slug || person.id}`,
                image: person.profile_image,
                description: person.deathdate ? `وفاة ${person.deathdate}` : undefined,
            })),
            ...payload.premieres.map((movie) => ({
                type: "Movie" as const,
                name: movie.title_ar || movie.title || movie.title_en || movie.id,
                url: `https://film.gmd.gdn/movies/${movie.slug || movie.id}`,
                dateCreated: movie.year,
                description: movie.release_date ? `عرض أول بتاريخ ${movie.release_date}` : undefined,
            })),
        ],
    })
    const schemas = [
        generateCollectionPageSchema({
            name: pageTitle,
            description: "مواليد ووفيات وعروض أولى مرتبطة بتاريخ اليوم داخل أرشيف السينما المصرية.",
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

            <section className="index-masthead relative overflow-hidden border-b border-white/10">
                <div className="absolute inset-0 hairline-grid opacity-40" />
                <div className="container relative py-16 md:py-24">
                    <Badge variant="outline" className="mb-4 border-white/25 bg-black/30 text-white">
                        <CalendarDays />
                        ذاكرة اليوم
                    </Badge>
                    <div className="flex flex-wrap items-end justify-between gap-6">
                        <div className="max-w-4xl text-white">
                            <h1 className="text-4xl font-bold leading-tight sm:text-5xl md:text-7xl">
                                حدث في مثل هذا اليوم
                            </h1>
                            <p className="mt-5 text-lg leading-8 text-white/72">
                                {formatTodayLabel(today)}. صفحة مستقلة داخل الواجهة الحالية تجمع مواليد اليوم، ذكرى
                                الرحيل، والعروض الأولى الموثقة متى كانت البيانات جاهزة.
                            </p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-lg border border-white/15 bg-black/35 px-5 py-4 text-center">
                                <div className="text-3xl font-bold text-primary">{payload.born.count.toLocaleString("ar-EG")}</div>
                                <div className="mt-1 text-sm text-white/72">مواليد</div>
                            </div>
                            <div className="rounded-lg border border-white/15 bg-black/35 px-5 py-4 text-center">
                                <div className="text-3xl font-bold text-primary">{payload.died.count.toLocaleString("ar-EG")}</div>
                                <div className="mt-1 text-sm text-white/72">وفيات</div>
                            </div>
                            <div className="rounded-lg border border-white/15 bg-black/35 px-5 py-4 text-center">
                                <div className="text-3xl font-bold text-primary">{payload.premieres.length.toLocaleString("ar-EG")}</div>
                                <div className="mt-1 text-sm text-white/72">عروض أولى</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="container py-12">
                <div className="grid gap-10 lg:grid-cols-2">
                    <Card className="border-white/10 bg-card/45">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-2xl">
                                <UserRound className="text-primary" />
                                مواليد اليوم
                            </CardTitle>
                            <CardDescription>
                                أسماء ارتبطت بتاريخ اليوم داخل أرشيف السينما المصرية.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {payload.born.people.length > 0 ? (
                                <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
                                    {payload.born.people.map((person) => (
                                        <PersonCard
                                            key={person.id}
                                            id={person.id}
                                            slug={person.slug || person.id}
                                            name={person.name_ar || person.name_en || "Unknown"}
                                            role={person.birthdate || undefined}
                                            imageUrl={person.profile_image}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-lg border border-dashed border-white/10 px-6 py-10 text-center text-muted-foreground">
                                    لا توجد مواليد مسجلة لهذا اليوم بعد.
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-white/10 bg-card/45">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-2xl">
                                <Sparkles className="text-primary" />
                                ذكرى الرحيل
                            </CardTitle>
                            <CardDescription>
                                صناع ونجوم ارتبط هذا التاريخ برحيلهم.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {payload.died.people.length > 0 ? (
                                <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
                                    {payload.died.people.map((person) => (
                                        <PersonCard
                                            key={person.id}
                                            id={person.id}
                                            slug={person.slug || person.id}
                                            name={person.name_ar || person.name_en || "Unknown"}
                                            role={person.deathdate || undefined}
                                            imageUrl={person.profile_image}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-lg border border-dashed border-white/10 px-6 py-10 text-center text-muted-foreground">
                                    لا توجد وفيات موثقة لهذا اليوم بعد.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <Card className="mt-10 border-white/10 bg-card/45">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-2xl">
                            <Clapperboard className="text-primary" />
                            العروض الأولى
                        </CardTitle>
                        <CardDescription>
                            {payload.note || "تظهر هنا الأعمال التي نملك لها تاريخ عرض أول مستقل في قاعدة البيانات."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {payload.premieres.length > 0 ? (
                            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                                {payload.premieres.map((movie) => (
                                    <MovieCard
                                        key={movie.id}
                                        id={movie.id}
                                        slug={movie.slug || movie.id}
                                        title={movie.title || movie.title_ar || movie.title_en || "Untitled"}
                                        year={movie.year || "غير معروف"}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-lg border border-dashed border-white/10 px-6 py-10 text-center text-muted-foreground">
                                لا توجد عروض أولى موثقة لهذا اليوم بعد.
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="mt-10 flex flex-wrap gap-3">
                    <Button asChild>
                        <Link href="/search">
                            ابحث في الأرشيف
                            <ArrowLeft data-icon="inline-end" />
                        </Link>
                    </Button>
                    <Button variant="outline" asChild>
                        <Link href="/movies">استكشف الأفلام</Link>
                    </Button>
                </div>
            </section>
        </div>
    )
}
