import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { FiltersSidebar } from "@/components/features/filters-sidebar"
import { PersonCard } from "@/components/features/person-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { generateCollectionPageSchema, generatePersonItemList, serializeJsonLd } from "@/lib/seo"

interface BrowsePeoplePageProps {
    searchParams: Promise<{
        page?: string
        orderBy?: string
    }>
}

const peopleOrderBy = ["name_ar", "name_en"] as const

function parsePeopleOrderBy(value?: string): (typeof peopleOrderBy)[number] {
    return peopleOrderBy.includes(value as (typeof peopleOrderBy)[number]) ? value as (typeof peopleOrderBy)[number] : "name_ar"
}

export default async function BrowsePeoplePage({ searchParams }: BrowsePeoplePageProps) {
    const params = await searchParams
    const currentPage = Math.max(parseInt(params.page || "1"), 1)
    const limit = 24
    const offset = (currentPage - 1) * limit

    const { people, count } = await api.listPeople({
        limit,
        offset,
        orderBy: parsePeopleOrderBy(params.orderBy),
    })

    const totalPages = Math.max(Math.ceil(count / limit), 1)
    const pageUrl = currentPage > 1 ? `https://film.gmd.gdn/people?page=${currentPage}` : "https://film.gmd.gdn/people"
    const itemListSchema = generatePersonItemList(people, {
        name: "فنانو ElFilm",
        url: pageUrl,
        startPosition: offset + 1,
    })
    const schemas = [
        generateCollectionPageSchema({
            name: "تصفح الفنانين",
            description: "قائمة الفنانين وصناع السينما داخل أرشيف ElFilm.",
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

            <section className="index-masthead relative mb-12 overflow-hidden border-b">
                <div className="absolute inset-0 hairline-grid opacity-40" />
                <div className="container relative py-16 md:py-24">
                <Badge variant="outline" className="mb-4 border-white/25 bg-black/30 text-white">الأسماء والوجوه</Badge>
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div className="max-w-3xl text-white">
                        <h1 className="text-5xl font-bold leading-tight md:text-7xl">تصفح الفنانين</h1>
                        <p className="mt-5 max-w-2xl text-lg leading-8 text-white/72">
                            ممثلون، مخرجون، كتاب، وصناع سينما شكلوا ذاكرة الشاشة المصرية.
                        </p>
                    </div>
                    <div className="border-y border-white/20 py-4 text-4xl font-bold text-primary">{count.toLocaleString("ar-EG")} فنان</div>
                </div>
                </div>
            </section>

            <div className="container grid gap-10 lg:grid-cols-[280px_1fr]">
                <aside className="hidden lg:block">
                    <div className="sticky top-24">
                        <FiltersSidebar type="people" />
                    </div>
                </aside>

                <div className="flex flex-col gap-8">
                    <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                        {people.map((person) => (
                            <PersonCard
                                key={person.id}
                                id={person.id}
                                slug={person.slug || person.id}
                                name={person.name_ar || person.name_en || "Unknown"}
                                imageUrl={person.profile_image}
                            />
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <Button variant="outline" disabled={currentPage <= 1} asChild={currentPage > 1}>
                            {currentPage > 1 ? (
                                <Link href={`/people?page=${currentPage - 1}`}>
                                    <ChevronRight />
                                    السابق
                                </Link>
                            ) : (
                                <span>
                                    <ChevronRight />
                                    السابق
                                </span>
                            )}
                        </Button>

                        <div className="rounded-md border bg-card px-4 py-2 text-sm font-medium">
                            صفحة {currentPage.toLocaleString("ar-EG")} من {totalPages.toLocaleString("ar-EG")}
                        </div>

                        <Button variant="outline" disabled={currentPage >= totalPages} asChild={currentPage < totalPages}>
                            {currentPage < totalPages ? (
                                <Link href={`/people?page=${currentPage + 1}`}>
                                    التالي
                                    <ChevronLeft />
                                </Link>
                            ) : (
                                <span>
                                    التالي
                                    <ChevronLeft />
                                </span>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
