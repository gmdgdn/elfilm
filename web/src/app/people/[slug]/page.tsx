import type { Metadata } from "next"
import Image from "next/image"
import { notFound } from "next/navigation"
import { CalendarDays, MapPin, UserRound } from "lucide-react"

import { FilmographyList } from "@/components/features/filmography-list"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { getHoroscope, HOROSCOPE_SIGNS } from "@/lib/horoscope-utils"
import { api, type PersonWithFilmography } from "@/lib/api"
import {
  buildPersonBlufSummary,
  generateBreadcrumbSchema,
  generatePersonMetadata,
  generatePersonSchema,
  serializeJsonLd,
} from "@/lib/seo"

interface PersonPageProps {
  params: Promise<{ slug: string }>
}

async function getPerson(slug: string): Promise<PersonWithFilmography | null> {
  try {
    const data = await api.getPerson(slug)
    return data.person
  } catch {
    return null
  }
}

function formatCareerRange(firstYear: number | null, lastYear: number | null) {
  if (!firstYear) return "—"
  if (!lastYear || firstYear === lastYear) return String(firstYear)
  return `${firstYear} - ${lastYear}`
}

export async function generateMetadata({ params }: PersonPageProps): Promise<Metadata> {
  const { slug } = await params
  const person = await getPerson(slug)

  if (!person) {
    return {
      title: {
        absolute: "فنان غير متاح | ElFilm Archive",
      },
      description: "صفحة الفنان المطلوبة غير متاحة حاليا داخل أرشيف ElFilm.",
    }
  }

  return generatePersonMetadata(person)
}

export default async function PersonPage({ params }: PersonPageProps) {
  const { slug } = await params
  const person = await getPerson(slug)

  if (!person) {
    notFound()
  }

  const name = person.name_ar || person.name_en || "Unknown"
  const blufSummary = buildPersonBlufSummary(person)
  const horoscope = person.birthdate ? getHoroscope(person.birthdate) : null
  const totalWorks =
    person.filmography.as_actor.length +
    person.filmography.as_director.length +
    person.filmography.as_writer.length +
    person.filmography.as_crew.length
  const activeYears = [
    ...person.filmography.as_actor,
    ...person.filmography.as_director,
    ...person.filmography.as_writer,
    ...person.filmography.as_crew,
  ].map((entry) => entry.year)
  const firstYear = activeYears.length > 0 ? Math.min(...activeYears) : null
  const lastYear = activeYears.length > 0 ? Math.max(...activeYears) : null
  const bio = person.bio_ar || person.bio
  const roleStats = [
    { label: "تمثيل", value: person.filmography.as_actor.length },
    { label: "إخراج", value: person.filmography.as_director.length },
    { label: "تأليف", value: person.filmography.as_writer.length },
    { label: "أدوار أخرى", value: person.filmography.as_crew.length },
  ].filter((item) => item.value > 0)
  const quickFacts = [
    person.full_name && person.full_name !== name
      ? { label: "الاسم الكامل", value: person.full_name }
      : null,
    person.name_en && person.name_en !== name
      ? { label: "الاسم الإنجليزي", value: person.name_en }
      : null,
    person.country ? { label: "البلد", value: person.country } : null,
    person.birthdate ? { label: "تاريخ الميلاد", value: person.birthdate } : null,
    person.deathdate ? { label: "تاريخ الوفاة", value: person.deathdate } : null,
    { label: "فترة العمل", value: formatCareerRange(firstYear, lastYear) },
  ].filter(Boolean) as { label: string; value: string }[]
  const url = `https://film.gmd.gdn/people/${person.slug || person.id}`
  const schemas = [
    generatePersonSchema(person),
    generateBreadcrumbSchema([
      { name: "الرئيسية", url: "https://film.gmd.gdn" },
      { name: "الفنانون", url: "https://film.gmd.gdn/people" },
      { name, url },
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

      <section className="grid gap-8 md:grid-cols-[300px_1fr] lg:gap-12">
        <div className="md:sticky md:top-24 md:self-start">
          <div className="overflow-hidden rounded-lg border bg-card shadow-2xl shadow-black/20">
            {person.profile_image ? (
              <Image
                src={person.profile_image}
                alt={name}
                width={300}
                height={450}
                className="aspect-[2/3] w-full object-cover"
                priority
              />
            ) : (
              <div className="flex aspect-[2/3] w-full items-center justify-center text-muted-foreground">
                <UserRound />
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col justify-center">
          <Badge variant="outline" className="mb-5 w-fit">صفحة فنان</Badge>
          <h1 className="text-4xl font-bold leading-tight md:text-6xl">{name}</h1>
          <p className="mt-4 max-w-3xl text-lg font-medium leading-8 text-muted-foreground">
            {blufSummary}
          </p>
          {person.name_en && person.name_en !== name && (
            <p className="mt-3 text-2xl text-muted-foreground">{person.name_en}</p>
          )}
          {person.full_name && person.full_name !== name && (
            <p className="mt-2 text-base text-muted-foreground">الاسم الكامل: {person.full_name}</p>
          )}

          <div className="mt-7 flex flex-wrap gap-3">
            {person.country && (
              <Badge variant="outline" className="gap-1">
                <MapPin />
                {person.country}
              </Badge>
            )}
            {person.birthdate && (
              <Badge variant="secondary" className="gap-1">
                <CalendarDays />
                مواليد {person.birthdate}
              </Badge>
            )}
            {person.deathdate && <Badge variant="secondary">وفاة {person.deathdate}</Badge>}
            {horoscope && <Badge variant="outline">{getHoroscope(person.birthdate!)} {HOROSCOPE_SIGNS[horoscope]?.icon}</Badge>}
          </div>

          {bio && (
            <p className="mt-8 max-w-3xl whitespace-pre-line text-lg leading-9 text-muted-foreground">
              {bio}
            </p>
          )}

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border bg-card/55 p-4">
              <p className="text-2xl font-bold text-primary">{totalWorks.toLocaleString("ar-EG")}</p>
              <p className="text-sm text-muted-foreground">إجمالي الأعمال</p>
            </div>
            <div className="rounded-lg border bg-card/55 p-4">
              <p className="text-2xl font-bold text-primary">{person.filmography.as_actor.length.toLocaleString("ar-EG")}</p>
              <p className="text-sm text-muted-foreground">أعمال تمثيل</p>
            </div>
            <div className="rounded-lg border bg-card/55 p-4">
              <p className="text-2xl font-bold text-primary">{person.filmography.as_director.length.toLocaleString("ar-EG")}</p>
              <p className="text-sm text-muted-foreground">أعمال إخراج</p>
            </div>
            <div className="rounded-lg border bg-card/55 p-4">
              <p className="text-2xl font-bold text-primary">
                {formatCareerRange(firstYear, lastYear)}
              </p>
              <p className="text-sm text-muted-foreground">فترة العمل</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-14 grid gap-8 lg:grid-cols-[1fr_320px]">
        <section>
          <div className="rounded-lg border bg-card/45 p-6">
            <Badge variant="outline" className="mb-3">نظرة سريعة</Badge>
            <h2 className="text-3xl font-bold">البيانات الأساسية</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {quickFacts.map((item) => (
                <div key={item.label} className="rounded-lg border bg-background/45 p-4">
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <p className="mt-2 font-semibold leading-7">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 rounded-lg border bg-card/45 p-6">
            <Badge variant="outline" className="mb-3">التخصصات</Badge>
            <h2 className="text-3xl font-bold">أبرز مجالات العمل</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {roleStats.map((item) => (
                <div key={item.label} className="rounded-lg border bg-background/45 p-4">
                  <p className="text-2xl font-bold text-primary">{item.value.toLocaleString("ar-EG")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <Badge variant="outline" className="mb-3">الأعمال</Badge>
          <h2 className="text-3xl font-bold">الفيلموجرافيا</h2>
          <div className="mt-2 flex flex-col gap-4">
            <FilmographyList title="تمثيل" entries={person.filmography.as_actor} />
            <FilmographyList title="إخراج" entries={person.filmography.as_director} />
            <FilmographyList title="تأليف" entries={person.filmography.as_writer} />
            <FilmographyList title="أدوار أخرى" entries={person.filmography.as_crew} />
          </div>
        </section>

        <aside>
          <Card className="bg-card/55">
            <CardContent className="flex flex-col gap-5 p-6">
              <h2 className="text-xl font-bold">ملخص السيرة</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border bg-background/45 p-4">
                  <p className="text-2xl font-bold text-primary">{person.filmography.as_actor.length}</p>
                  <p className="text-sm text-muted-foreground">تمثيل</p>
                </div>
                <div className="rounded-lg border bg-background/45 p-4">
                  <p className="text-2xl font-bold text-primary">{person.filmography.as_director.length}</p>
                  <p className="text-sm text-muted-foreground">إخراج</p>
                </div>
                <div className="rounded-lg border bg-background/45 p-4">
                  <p className="text-2xl font-bold text-primary">{person.filmography.as_writer.length}</p>
                  <p className="text-sm text-muted-foreground">تأليف</p>
                </div>
                <div className="rounded-lg border bg-background/45 p-4">
                  <p className="text-2xl font-bold text-primary">{person.filmography.as_crew.length}</p>
                  <p className="text-sm text-muted-foreground">أخرى</p>
                </div>
              </div>
              <div className="space-y-3">
                {quickFacts.slice(0, 4).map((item) => (
                  <div key={item.label} className="rounded-lg border bg-background/45 p-4">
                    <p className="text-sm text-muted-foreground">{item.label}</p>
                    <p className="mt-2 font-semibold leading-7">{item.value}</p>
                  </div>
                ))}
              </div>
              {bio ? (
                <div className="rounded-lg border bg-background/45 p-4">
                  <p className="text-sm text-muted-foreground">نبذة مختصرة</p>
                  <p className="mt-2 line-clamp-6 whitespace-pre-line text-sm leading-7">
                    {bio}
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed bg-background/30 p-4 text-sm text-muted-foreground">
                  لا توجد نبذة متاحة حاليا.
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </section>
    </article>
  )
}
