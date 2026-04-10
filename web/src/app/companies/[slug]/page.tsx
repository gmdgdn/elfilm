import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Building2 } from "lucide-react"

import { FilmographyList } from "@/components/features/filmography-list"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { api, type CompanyWithProductions } from "@/lib/api"
import {
    buildCompanyBlufSummary,
    generateBreadcrumbSchema,
    generateCompanyMetadata,
    generateCompanySchema,
    serializeJsonLd,
} from "@/lib/seo"

interface CompanyPageProps {
    params: Promise<{ slug: string }>
}

async function getCompany(slug: string): Promise<CompanyWithProductions | null> {
    try {
        const data = await api.getCompany(slug)
        return data.company
    } catch {
        return null
    }
}

function formatCompanyRole(role: string) {
    const normalized = role.trim().toLowerCase()
    if (!normalized || normalized === "company") return "شركة"
    if (normalized === "production") return "إنتاج"
    if (normalized === "distribution") return "توزيع"
    if (normalized === "studio") return "استوديو"
    return role
}

export async function generateMetadata({ params }: CompanyPageProps): Promise<Metadata> {
    const { slug } = await params
    const company = await getCompany(slug)

    if (!company) {
        return {
            title: {
                absolute: "شركة غير متاحة | ElFilm Archive",
            },
            description: "صفحة الشركة المطلوبة غير متاحة حاليا داخل أرشيف ElFilm.",
        }
    }

    return generateCompanyMetadata(company)
}

export default async function CompanyPage({ params }: CompanyPageProps) {
    const { slug } = await params
    const company = await getCompany(slug)

    if (!company) {
        notFound()
    }

    const roleCounts = company.productions.reduce<Record<string, number>>((acc, production) => {
        const key = production.role_kind || "company"
        acc[key] = (acc[key] || 0) + 1
        return acc
    }, {})
    const sortedRoleCounts = Object.entries(roleCounts).sort(([, left], [, right]) => right - left)
    const productionYears = company.productions.map((production) => production.year).filter(Boolean)
    const firstYear = productionYears.length > 0 ? Math.min(...productionYears) : null
    const lastYear = productionYears.length > 0 ? Math.max(...productionYears) : null
    const quickFacts = [
        company.name_en ? { label: "الاسم الإنجليزي", value: company.name_en } : null,
        company.kind ? { label: "نوع الجهة", value: company.kind } : null,
        company.country ? { label: "البلد", value: company.country } : null,
        company.founded_year ? { label: "سنة التأسيس", value: String(company.founded_year) } : null,
        company.closed_year ? { label: "سنة الإغلاق", value: String(company.closed_year) } : null,
        firstYear ? { label: "أول ظهور بالأرشيف", value: String(firstYear) } : null,
        lastYear ? { label: "أحدث ظهور بالأرشيف", value: String(lastYear) } : null,
    ].filter(Boolean) as { label: string; value: string }[]
    const companyName = company.name_ar || company.name_en || "شركة سينمائية"
    const blufSummary = buildCompanyBlufSummary(company)
    const url = `https://film.gmd.gdn/companies/${company.slug || company.id}`
    const schemas = [
        generateCompanySchema(company),
        generateBreadcrumbSchema([
            { name: "الرئيسية", url: "https://film.gmd.gdn" },
            { name: "الشركات", url: "https://film.gmd.gdn/companies" },
            { name: companyName, url },
        ]),
    ]

    return (
        <article className="container py-10">
            {schemas.map((schema) => (
                <script
                    key={(schema as { "@type": string })["@type"]}
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: serializeJsonLd(schema),
                    }}
                />
            ))}

            <section className="grid gap-8 rounded-lg border bg-card/45 p-6 md:grid-cols-[auto_1fr] md:p-8">
                <span className="flex size-16 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                    <Building2 />
                </span>
                <div>
                    <Badge variant="outline" className="mb-5">شركة سينمائية</Badge>
                    <h1 className="text-4xl font-bold leading-tight md:text-6xl">{companyName}</h1>
                    <p className="mt-4 max-w-3xl text-lg font-medium leading-8 text-muted-foreground">
                        {blufSummary}
                    </p>
                    {company.name_en && <p className="mt-3 text-2xl text-muted-foreground">{company.name_en}</p>}
                    <div className="mt-7 flex flex-wrap gap-3">
                        {company.country && <Badge variant="outline">{company.country}</Badge>}
                        {company.kind && <Badge variant="secondary">{company.kind}</Badge>}
                        {company.founded_year && <Badge variant="secondary">تأسست {company.founded_year}</Badge>}
                        {company.closed_year && <Badge variant="secondary">أغلقت {company.closed_year}</Badge>}
                        <Badge variant="secondary">{company.productions.length} عمل</Badge>
                    </div>
                </div>
            </section>

            <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_320px]">
                <div>
                    <section className="rounded-lg border bg-card/45 p-6">
                        <Badge variant="outline" className="mb-3">البيانات الأساسية</Badge>
                        <h2 className="text-3xl font-bold">معلومات الشركة</h2>
                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                            {quickFacts.map((item) => (
                                <div key={item.label} className="rounded-lg border bg-background/45 p-4">
                                    <p className="text-sm text-muted-foreground">{item.label}</p>
                                    <p className="mt-2 font-semibold leading-7">{item.value}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="mt-8 rounded-lg border bg-card/45 p-6">
                        <Badge variant="outline" className="mb-3">نبذة</Badge>
                        <h2 className="text-3xl font-bold">عن الشركة</h2>
                        {company.description_ar ? (
                            <p className="mt-5 max-w-4xl whitespace-pre-line text-lg leading-9 text-muted-foreground">
                                {company.description_ar}
                            </p>
                        ) : (
                            <p className="mt-5 text-muted-foreground">لا توجد نبذة متاحة حاليا.</p>
                        )}
                    </section>

                    <section className="mt-8 rounded-lg border bg-card/45 p-6">
                        <Badge variant="outline" className="mb-3">التوزيع</Badge>
                        <h2 className="text-3xl font-bold">ملخص الأدوار</h2>
                        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            {sortedRoleCounts.map(([role, count]) => (
                                <div key={role} className="rounded-lg border bg-card/45 p-4">
                                    <p className="text-2xl font-bold text-primary">{count}</p>
                                    <p className="mt-1 text-sm text-muted-foreground">{formatCompanyRole(role)}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    <div className="mt-8">
                        <FilmographyList
                            title="إنتاج وتوزيع"
                            entries={company.productions.map((production) => ({
                                ...production,
                                role_credit: formatCompanyRole(production.role_kind),
                            }))}
                        />
                    </div>
                </div>

                <aside>
                    <Card className="bg-card/55">
                        <CardContent className="flex flex-col gap-4 p-6">
                            <div>
                                <p className="text-4xl font-bold text-primary">{company.productions.length}</p>
                                <p className="mt-2 text-sm text-muted-foreground">عمل مرتبط في الأرشيف</p>
                            </div>
                            {firstYear && lastYear && (
                                <div className="rounded-lg border bg-background/45 p-4">
                                    <p className="text-sm text-muted-foreground">فترة الحضور بالأرشيف</p>
                                    <p className="mt-2 font-semibold">
                                        {firstYear === lastYear ? firstYear : `${firstYear} - ${lastYear}`}
                                    </p>
                                </div>
                            )}
                            <div className="space-y-3">
                                {sortedRoleCounts.slice(0, 3).map(([role, count]) => (
                                    <div key={role} className="rounded-lg border bg-background/45 p-4">
                                        <p className="text-sm text-muted-foreground">{formatCompanyRole(role)}</p>
                                        <p className="mt-2 font-semibold">{count} عمل</p>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </aside>
            </div>
        </article>
    )
}
