import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import type { FilmographyEntry } from "@/lib/api"

interface FilmographyListProps {
    title: string
    entries: FilmographyEntry[]
}

export function FilmographyList({ title, entries }: FilmographyListProps) {
    if (entries.length === 0) return null

    const sortedEntries = [...entries].sort((a, b) => b.year - a.year)

    return (
        <section className="mt-8">
            <h3 className="mb-4 flex items-center gap-2 text-xl font-bold">
                {title}
                <Badge variant="secondary" className="text-sm font-normal">
                    {entries.length.toLocaleString("ar-EG")}
                </Badge>
            </h3>
            <div className="divide-y rounded-lg border bg-card/45">
                {sortedEntries.map((entry) => (
                    <Link
                        key={`${entry.movie_id}-${entry.role_kind}-${entry.role_credit || ""}`}
                        href={`/movies/${entry.movie_slug || entry.movie_id}`}
                        className="group flex items-center justify-between gap-4 p-4 transition-colors hover:bg-accent/60"
                    >
                        <div className="min-w-0">
                            <p className="line-clamp-1 font-semibold group-hover:text-primary">
                                {entry.title_ar}
                            </p>
                            {entry.role_credit && (
                                <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                                    {entry.role_credit}
                                </p>
                            )}
                        </div>
                        <Badge variant="outline">{entry.year}</Badge>
                    </Link>
                ))}
            </div>
        </section>
    )
}
