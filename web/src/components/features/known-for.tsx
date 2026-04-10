import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Star } from "lucide-react"

interface KnownForMovie {
    id: string
    slug: string
    title: string
    year: number
    role: string
    rating: number
    posterUrl?: string | null
}

interface KnownForProps {
    movies: KnownForMovie[]
}

export function KnownFor({ movies }: KnownForProps) {
    if (!movies || movies.length === 0) return null

    // Sort by rating descending and take top 8
    const topMovies = [...movies]
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 8)

    return (
        <section className="space-y-4">
            <h3 className="text-2xl font-bold">أشهر الأعمال</h3>

            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                {topMovies.map((movie) => (
                    <Link
                        key={movie.id}
                        href={`/movies/${movie.slug}`}
                        className="min-w-[140px] max-w-[140px] group"
                    >
                        <Card className="overflow-hidden border-0 bg-transparent transition-all hover:scale-105">
                            <CardContent className="p-0">
                                <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted">
                                    {movie.posterUrl ? (
                                        <img
                                            src={movie.posterUrl}
                                            alt={movie.title}
                                            className="h-full w-full object-cover transition-all group-hover:brightness-110"
                                        />
                                    ) : (
                                        <div className="flex h-full items-center justify-center text-muted-foreground">
                                            <span className="text-2xl">🎬</span>
                                        </div>
                                    )}
                                    <div className="absolute top-2 right-2">
                                        <Badge variant="secondary" className="flex items-center gap-1 bg-black/60 text-white backdrop-blur-sm">
                                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                            {movie.rating.toFixed(1)}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="mt-2 space-y-1">
                                    <h4 className="line-clamp-1 text-sm font-semibold group-hover:text-primary">
                                        {movie.title}
                                    </h4>
                                    <p className="text-xs text-muted-foreground">
                                        {movie.role} • {movie.year}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        </section>
    )
}
