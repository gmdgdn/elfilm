import Link from "next/link"
import { ArrowLeft, Building2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { api } from "@/lib/api"
import { generateCollectionPageSchema, generateCompanyItemList, serializeJsonLd } from "@/lib/seo"

interface CompaniesPageProps {
    searchParams: Promise<{
        page?: string
    }>
}

export default async function CompaniesPage({ searchParams }: CompaniesPageProps) {
    const params = await searchParams
    const currentPage = Math.max(parseInt(params.page || "1"), 1)
    const limit = 30
    const offset = (currentPage - 1) * limit
    const { companies, count } = await api.listCompanies({
        limit,
        offset,
        orderBy: "name_ar",
    })
    const totalPages = Math.max(Math.ceil(count / limit), 1)
    const pageUrl = currentPage > 1 ? `https://film.gmd.gdn/companies?page=${currentPage}` : "https://film.gmd.gdn/companies"
    const itemListSchema = generateCompanyItemList(companies, {
        name: "شركات ElFilm",
        url: pageUrl,
        startPosition: offset + 1,
    })
    const schemas = [
        generateCollectionPageSchema({
            name: "شركات السينما",
            description: "قائمة شركات الإنتاج والتوزيع والاستوديوهات داخل أرشيف ElFilm.",
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
                <Badge variant="outline" className="mb-4 border-white/25 bg-black/30 text-white">بيوت الإنتاج</Badge>
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div className="max-w-3xl text-white">
                        <h1 className="text-5xl font-bold leading-tight md:text-7xl">شركات السينما</h1>
                        <p className="mt-5 max-w-2xl text-lg leading-8 text-white/72">
                            شركات الإنتاج والتوزيع التي وقفت خلف الأفلام، المواسم، والحقب السينمائية.
                        </p>
                    </div>
                    <div className="border-y border-white/20 py-4 text-4xl font-bold text-primary">{count.toLocaleString("ar-EG")} شركة</div>
                </div>
                </div>
            </section>

            <div className="container grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {companies.map((company) => (
                    <Link key={company.id} href={`/companies/${company.slug || company.id}`} className="group">
                        <Card className="h-full bg-card/55 transition-colors hover:bg-accent/60">
                            <CardContent className="flex h-full flex-col gap-5 p-6">
                                <div className="flex items-start justify-between gap-4">
                                    <span className="flex size-11 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
                                        <Building2 />
                                    </span>
                                    <ArrowLeft className="text-muted-foreground transition-transform group-hover:-translate-x-1 group-hover:text-primary" />
                                </div>
                                <div>
                                    <h2 className="line-clamp-2 text-xl font-bold">{company.name_ar}</h2>
                                    {company.name_en && (
                                        <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{company.name_en}</p>
                                    )}
                                </div>
                                <div className="mt-auto flex flex-wrap gap-2">
                                    {company.kind && <Badge variant="secondary">{company.kind}</Badge>}
                                    {company.founded_year && <Badge variant="outline">{company.founded_year}</Badge>}
                                    {company.country && <Badge variant="outline">{company.country}</Badge>}
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>

            <div className="container mt-10 flex flex-wrap items-center justify-center gap-3">
                <Button variant="outline" disabled={currentPage <= 1} asChild={currentPage > 1}>
                    {currentPage > 1 ? <Link href={`/companies?page=${currentPage - 1}`}>السابق</Link> : <span>السابق</span>}
                </Button>
                <div className="rounded-md border bg-card px-4 py-2 text-sm font-medium">
                    صفحة {currentPage.toLocaleString("ar-EG")} من {totalPages.toLocaleString("ar-EG")}
                </div>
                <Button variant="outline" disabled={currentPage >= totalPages} asChild={currentPage < totalPages}>
                    {currentPage < totalPages ? <Link href={`/companies?page=${currentPage + 1}`}>التالي</Link> : <span>التالي</span>}
                </Button>
            </div>
        </div>
    )
}
