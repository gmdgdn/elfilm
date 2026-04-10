"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  Activity,
  ArrowRight,
  Bot,
  Building2,
  Clapperboard,
  Database,
  FileClock,
  Radar,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Tags,
  UsersRound,
} from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  adminApi,
  type AuditLogItem,
  type DashboardStats,
  type GenreDistributionStat,
  type MoviesByDecadeStat,
  type RecentActivityItem,
  type TopCreditStat,
  type VectorIndexInfo,
} from "@/lib/adminApi"

interface DashboardData {
  stats: DashboardStats | null
  recentActivity: RecentActivityItem[]
  decadeStats: MoviesByDecadeStat[]
  genreDistribution: GenreDistributionStat[]
  topActors: TopCreditStat[]
  topDirectors: TopCreditStat[]
  vectorInfo: VectorIndexInfo | null
  auditLog: AuditLogItem[]
}

const emptyDashboard: DashboardData = {
  stats: null,
  recentActivity: [],
  decadeStats: [],
  genreDistribution: [],
  topActors: [],
  topDirectors: [],
  vectorInfo: null,
  auditLog: [],
}

const numberFormatter = new Intl.NumberFormat("en-US")
const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
})
const dateFormatter = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" })

const collectionBlueprint = [
  {
    label: "Movies",
    href: "/admin/movies",
    description: "Feature films, episodic releases, runtime data, and editorial metadata.",
    icon: Clapperboard,
    tone: "from-primary/20 via-primary/10 to-transparent",
  },
  {
    label: "People",
    href: "/admin/people",
    description: "Actors, directors, writers, and behind-the-camera relationships.",
    icon: UsersRound,
    tone: "from-sky-500/18 via-sky-500/5 to-transparent",
  },
  {
    label: "Companies",
    href: "/admin/companies",
    description: "Studios, production houses, distributors, and archive partners.",
    icon: Building2,
    tone: "from-emerald-500/18 via-emerald-500/6 to-transparent",
  },
  {
    label: "Taxonomy",
    href: "/admin/taxonomy",
    description: "Genres, tags, and the collection structure readers navigate through.",
    icon: Tags,
    tone: "from-amber-500/18 via-amber-500/5 to-transparent",
  },
  {
    label: "Database",
    href: "/admin/database",
    description: "Schema-aware CRUD for join tables, watch links, news, settings, and system state.",
    icon: Database,
    tone: "from-fuchsia-500/18 via-fuchsia-500/6 to-transparent",
  },
]

const emdashSignals = [
  {
    title: "Collections-first model",
    description: "Archive entities are organized as discrete operational surfaces instead of a single overloaded posts table.",
    icon: Database,
  },
  {
    title: "Scoped automation runway",
    description: "Vector indexing, imports, and admin actions are isolated so future agent tooling can plug in safely.",
    icon: Bot,
  },
  {
    title: "Traceable operations",
    description: "Audit logs and explicit maintenance tools make editorial changes easier to trust and review.",
    icon: FileClock,
  },
  {
    title: "Edge-native posture",
    description: "The dashboard assumes a Cloudflare deployment model with fast control loops and serverless maintenance.",
    icon: ShieldCheck,
  },
]

function formatCount(value: number) {
  return numberFormatter.format(value)
}

function formatCompactCount(value: number) {
  return compactNumberFormatter.format(value)
}

function formatDate(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return dateFormatter.format(parsed)
}

function readNumber(info: VectorIndexInfo | null, keys: string[]) {
  if (!info) {
    return null
  }

  for (const key of keys) {
    const value = info[key]
    if (typeof value === "number") {
      return value
    }
  }

  return null
}

function describeAuditEntry(entry: AuditLogItem) {
  const subject = entry.entity_type.replace("_", " ")
  const action = entry.action === "create" ? "Created" : entry.action === "update" ? "Updated" : "Deleted"

  return `${action} ${subject}`
}

function parseAuditDetails(entry: AuditLogItem) {
  if (!entry.details) {
    return "No payload details recorded."
  }

  try {
    const parsed = JSON.parse(entry.details) as Record<string, unknown>
    const focusValue = parsed.title_ar ?? parsed.name_ar ?? parsed.offset ?? parsed.year ?? parsed.slug

    if (typeof focusValue === "string" || typeof focusValue === "number") {
      return String(focusValue)
    }
  } catch {
    return entry.details
  }

  return "Structured change payload"
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData>(emptyDashboard)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [partialFailures, setPartialFailures] = useState<string[]>([])

  useEffect(() => {
    void loadDashboard(true)
  }, [])

  async function loadDashboard(isInitialLoad = false) {
    if (isInitialLoad) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }

    setError(null)

    const requests = [
      { label: "stats", promise: adminApi.getStats() },
      { label: "recent activity", promise: adminApi.getRecentActivity(8) },
      { label: "decade analytics", promise: adminApi.getMoviesByDecadeStats() },
      { label: "genre distribution", promise: adminApi.getGenreDistribution() },
      { label: "top actors", promise: adminApi.getTopActors(5) },
      { label: "top directors", promise: adminApi.getTopDirectors(5) },
      { label: "vector status", promise: adminApi.getVectorStatus() },
      { label: "audit log", promise: adminApi.getAuditLog({ limit: 6 }) },
    ] as const

    try {
      const results = await Promise.allSettled(requests.map((request) => request.promise))
      const failedLabels = results.flatMap((result, index) =>
        result.status === "rejected" ? [requests[index].label] : []
      )

      const statsResponse =
        results[0].status === "fulfilled" ? (results[0].value as Awaited<ReturnType<typeof adminApi.getStats>>) : null
      const recentActivityResponse =
        results[1].status === "fulfilled"
          ? (results[1].value as Awaited<ReturnType<typeof adminApi.getRecentActivity>>)
          : null
      const decadeResponse =
        results[2].status === "fulfilled"
          ? (results[2].value as Awaited<ReturnType<typeof adminApi.getMoviesByDecadeStats>>)
          : null
      const genreResponse =
        results[3].status === "fulfilled"
          ? (results[3].value as Awaited<ReturnType<typeof adminApi.getGenreDistribution>>)
          : null
      const actorResponse =
        results[4].status === "fulfilled" ? (results[4].value as Awaited<ReturnType<typeof adminApi.getTopActors>>) : null
      const directorResponse =
        results[5].status === "fulfilled"
          ? (results[5].value as Awaited<ReturnType<typeof adminApi.getTopDirectors>>)
          : null
      const vectorResponse =
        results[6].status === "fulfilled"
          ? (results[6].value as Awaited<ReturnType<typeof adminApi.getVectorStatus>>)
          : null
      const auditResponse =
        results[7].status === "fulfilled" ? (results[7].value as Awaited<ReturnType<typeof adminApi.getAuditLog>>) : null

      const nextState: DashboardData = {
        stats: statsResponse?.stats ?? null,
        recentActivity: recentActivityResponse?.data ?? [],
        decadeStats: decadeResponse?.data ?? [],
        genreDistribution: genreResponse?.data ?? [],
        topActors: actorResponse?.data ?? [],
        topDirectors: directorResponse?.data ?? [],
        vectorInfo: vectorResponse?.info ?? null,
        auditLog: auditResponse?.logs ?? [],
      }

      if (!nextState.stats) {
        setError("The dashboard could not load its core archive metrics. Check the admin API configuration and try again.")
      }

      setData(nextState)
      setPartialFailures(failedLabels)
    } catch {
      setError("The dashboard failed to connect to the admin APIs.")
      setData(emptyDashboard)
      setPartialFailures([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const totalManagedEntities = data.stats
    ? data.stats.totalMovies + data.stats.totalPeople + data.stats.totalCompanies
    : 0
  const vectorCount = readNumber(data.vectorInfo, ["count", "vectorCount", "indexedVectors", "vectors"])
  const vectorDimensions = readNumber(data.vectorInfo, ["dimensions", "dimension"])
  const primaryGenre = data.genreDistribution[0]
  const decadeChartData = [...data.decadeStats]
    .sort((left, right) => left.decade - right.decade)
    .map((entry) => ({
      label: `${entry.decade}s`,
      count: entry.count,
    }))
  const genreChartData = data.genreDistribution.slice(0, 6).map((entry) => ({
    label: entry.name_en || entry.name_ar,
    count: entry.count,
  }))
  const statCards = data.stats
    ? [
        {
          label: "Movies",
          value: data.stats.totalMovies,
          detail: `${formatCount(data.stats.recentMovies)} added in the last 30 days`,
          icon: Clapperboard,
        },
        {
          label: "People",
          value: data.stats.totalPeople,
          detail: `${formatCount(data.stats.recentPeople)} recent contributor records`,
          icon: UsersRound,
        },
        {
          label: "Companies",
          value: data.stats.totalCompanies,
          detail: "Studios, distributors, and archive partners",
          icon: Building2,
        },
        {
          label: "Taxonomy",
          value: data.stats.totalGenres + data.stats.totalTags,
          detail: `${formatCount(data.stats.totalGenres)} genres and ${formatCount(data.stats.totalTags)} tags`,
          icon: Tags,
        },
      ]
    : []

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,oklch(0.16_0.03_28),oklch(0.08_0_0)_62%)]">
        <div className="grid gap-8 px-6 py-7 lg:grid-cols-[minmax(0,1.25fr)_360px] lg:px-8 lg:py-8">
          <div>
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              EmDash-inspired admin dashboard
            </Badge>
            <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Operate the ElFilm archive as a set of collections, signals, and trusted workflows.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-300 sm:text-base">
              This overview pulls together archive growth, vector indexing, editorial activity, and the collection
              structure that powers the public site.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/admin/movies/new">
                  Add movie
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                <Link href="/admin/database">
                  Open database studio
                  <Database className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                <Link href="/admin/vectorize">
                  Open vector search
                  <Radar className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                variant="ghost"
                className="text-zinc-200 hover:bg-white/10 hover:text-white"
                onClick={() => void loadDashboard()}
                disabled={loading || refreshing}
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                Refresh signals
              </Button>
            </div>

            {(error || partialFailures.length > 0) && (
              <div className="mt-6 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                {error || `Some dashboard modules are unavailable: ${partialFailures.join(", ")}.`}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Managed entities</p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {loading ? "..." : formatCompactCount(totalManagedEntities)}
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Movies, people, and companies currently available to editors.
              </p>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Vector index</p>
              <p className="mt-3 text-3xl font-semibold text-white">
                {loading ? "..." : vectorCount !== null ? formatCompactCount(vectorCount) : "Ready"}
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                {vectorDimensions !== null
                  ? `${formatCount(vectorDimensions)} dimensions currently configured.`
                  : "Index status is available for semantic archive search."}
              </p>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Lead genre</p>
              <p className="mt-3 text-2xl font-semibold text-white">{loading ? "..." : primaryGenre?.name_ar || "Unassigned"}</p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                {primaryGenre ? `${formatCount(primaryGenre.count)} titles currently mapped.` : "Genre mix will appear once analytics are available."}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => (
              <Card key={index} className="rounded-[24px] border-white/10 bg-black/25">
                <CardHeader>
                  <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
                  <div className="h-8 w-20 animate-pulse rounded bg-white/10" />
                </CardHeader>
                <CardContent>
                  <div className="h-4 w-40 animate-pulse rounded bg-white/10" />
                </CardContent>
              </Card>
            ))
          : statCards.map((card) => {
              const Icon = card.icon

              return (
                <Card key={card.label} className="rounded-[24px] border-white/10 bg-black/25">
                  <CardHeader className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <CardDescription className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                        {card.label}
                      </CardDescription>
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                    </div>
                    <CardTitle className="text-3xl">{formatCount(card.value)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-6 text-muted-foreground">{card.detail}</p>
                  </CardContent>
                </Card>
              )
            })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_400px]">
        <Card className="rounded-[28px] border-white/10 bg-black/25">
          <CardHeader className="flex flex-row items-start justify-between gap-6">
            <div>
              <CardTitle className="text-xl">Archive tempo</CardTitle>
              <CardDescription>
                Film volume by decade, to help editors spot density shifts and indexing priorities.
              </CardDescription>
            </div>
            <Badge variant="outline" className="border-white/10 bg-white/5 text-muted-foreground">
              {decadeChartData.length} decades
            </Badge>
          </CardHeader>
          <CardContent className="h-[320px]">
            {decadeChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={decadeChartData}>
                  <defs>
                    <linearGradient id="decadeArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.06} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={42}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(18, 18, 18, 0.96)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "18px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="var(--color-primary)"
                    fill="url(#decadeArea)"
                    strokeWidth={2.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-[20px] border border-dashed border-white/10 text-sm text-muted-foreground">
                Decade analytics will appear once the admin API is reachable.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-white/10 bg-black/25">
          <CardHeader>
            <CardTitle className="text-xl">EmDash patterns in this build</CardTitle>
            <CardDescription>
              The dashboard is organized around the same operating ideas highlighted in the EmDash launch.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {emdashSignals.map((signal) => {
              const Icon = signal.icon

              return (
                <div key={signal.title} className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">{signal.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{signal.description}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Card className="rounded-[28px] border-white/10 bg-black/25">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-xl">Collection map</CardTitle>
              <CardDescription>
                Jump directly into the archive surfaces editors work in most often.
              </CardDescription>
            </div>
            <Badge variant="outline" className="border-white/10 bg-white/5 text-muted-foreground">
              {data.stats ? formatCount(totalManagedEntities) : "0"} records
            </Badge>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {collectionBlueprint.map((collection) => {
              const Icon = collection.icon
              const count =
                collection.label === "Movies"
                  ? data.stats?.totalMovies
                  : collection.label === "People"
                    ? data.stats?.totalPeople
                    : collection.label === "Companies"
                      ? data.stats?.totalCompanies
                      : collection.label === "Database"
                        ? data.stats
                          ? data.stats.totalMovies +
                            data.stats.totalPeople +
                            data.stats.totalCompanies +
                            data.stats.totalGenres +
                            data.stats.totalTags
                          : undefined
                      : data.stats
                        ? data.stats.totalGenres + data.stats.totalTags
                        : undefined

              return (
                <Link
                  key={collection.label}
                  href={collection.href}
                  className={`group overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-br ${collection.tone} p-5 transition-transform hover:-translate-y-1`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <div className="mt-8">
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{collection.label}</p>
                    <p className="mt-3 text-3xl font-semibold text-foreground">{count !== undefined ? formatCompactCount(count) : "..."}</p>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{collection.description}</p>
                  </div>
                </Link>
              )
            })}
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-white/10 bg-black/25">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-xl">Genre balance</CardTitle>
              <CardDescription>Top mapped genres across the archive catalogue.</CardDescription>
            </div>
            <Sparkles className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent className="h-[320px]">
            {genreChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={genreChartData} layout="vertical" margin={{ left: 12, right: 16 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tick={{ fill: "rgba(255,255,255,0.72)", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={112}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(18, 18, 18, 0.96)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "18px",
                    }}
                  />
                  <Bar dataKey="count" radius={[10, 10, 10, 10]} fill="var(--color-chart-2)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-[20px] border border-dashed border-white/10 text-sm text-muted-foreground">
                Genre analytics are not available yet.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)]">
        <Card className="rounded-[28px] border-white/10 bg-black/25">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-xl">Recent publishing activity</CardTitle>
              <CardDescription>Latest movie records entering the collection.</CardDescription>
            </div>
            <Badge variant="outline" className="border-white/10 bg-white/5 text-muted-foreground">
              {data.recentActivity.length} items
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recentActivity.length > 0 ? (
              data.recentActivity.map((entry) => (
                <Link
                  key={entry.id}
                  href={`/admin/movies/${entry.id}/edit`}
                  className="flex flex-col gap-3 rounded-[22px] border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/8 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 text-xs uppercase tracking-[0.24em] text-muted-foreground">
                      <span>{entry.year}</span>
                      <span className="h-1 w-1 rounded-full bg-muted-foreground" />
                      <span>Movie</span>
                    </div>
                    <p dir="rtl" className="mt-3 text-right text-base font-medium text-foreground">
                      {entry.title_ar}
                    </p>
                    {entry.title_en && <p className="mt-1 text-sm text-muted-foreground">{entry.title_en}</p>}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>{formatDate(entry.created_at)}</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-[22px] border border-dashed border-white/10 px-4 py-8 text-center text-sm text-muted-foreground">
                Recent publishing activity will appear here once the admin API returns data.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card className="rounded-[28px] border-white/10 bg-black/25">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-xl">Contributor leaders</CardTitle>
                <CardDescription>Most frequently credited actors and directors in the archive.</CardDescription>
              </div>
              <Activity className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Actors</p>
                <div className="mt-3 space-y-3">
                  {data.topActors.map((person, index) => (
                    <Link
                      key={person.id}
                      href={`/admin/people/${person.id}/edit`}
                      className="flex items-center justify-between gap-4 rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 transition-colors hover:bg-white/8"
                    >
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">#{index + 1}</p>
                        <p dir="rtl" className="mt-2 truncate text-right font-medium text-foreground">
                          {person.name_ar}
                        </p>
                      </div>
                      <span className="text-sm text-muted-foreground">{formatCount(person.count)}</span>
                    </Link>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Directors</p>
                <div className="mt-3 space-y-3">
                  {data.topDirectors.map((person, index) => (
                    <Link
                      key={person.id}
                      href={`/admin/people/${person.id}/edit`}
                      className="flex items-center justify-between gap-4 rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 transition-colors hover:bg-white/8"
                    >
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">#{index + 1}</p>
                        <p dir="rtl" className="mt-2 truncate text-right font-medium text-foreground">
                          {person.name_ar}
                        </p>
                      </div>
                      <span className="text-sm text-muted-foreground">{formatCount(person.count)}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-white/10 bg-black/25">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-xl">Operational ledger</CardTitle>
                <CardDescription>Recent write actions captured in the audit trail.</CardDescription>
              </div>
              <FileClock className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent className="space-y-3">
              {data.auditLog.length > 0 ? (
                data.auditLog.map((entry) => (
                  <div key={entry.id} className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-foreground">{describeAuditEntry(entry)}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{parseAuditDetails(entry)}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          entry.action === "delete"
                            ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                            : entry.action === "create"
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                              : "border-white/10 bg-white/5 text-muted-foreground"
                        }
                      >
                        {entry.action}
                      </Badge>
                    </div>
                    <p className="mt-3 text-xs uppercase tracking-[0.24em] text-muted-foreground">
                      {entry.entity_type.replace("_", " ")} · {formatDate(entry.created_at)}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-[22px] border border-dashed border-white/10 px-4 py-8 text-center text-sm text-muted-foreground">
                  Audit activity will appear once editors begin writing through the admin API.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
