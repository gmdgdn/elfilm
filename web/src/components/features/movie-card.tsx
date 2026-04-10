import Link from "next/link"
import { Clapperboard, Star } from "lucide-react"

import { MediaImage } from "@/components/features/media-image"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface MovieCardProps {
    id: string
    slug?: string
    title: string
    year: number | string
    posterUrl?: string | null
    rating?: number | string | null
    className?: string
}

export function MovieCard({
    id,
    slug,
    title,
    year,
    posterUrl,
    rating,
    className,
}: MovieCardProps) {
    const ratingNum = typeof rating === "string" ? parseFloat(rating) : rating

    return (
        <Link href={`/movies/${slug || id}`} className={cn("group block rounded-md", className)}>
            <Card className="overflow-hidden border-0 bg-transparent py-0 shadow-none">
                <CardContent className="p-0">
                    <div className="poster-lift relative aspect-[2/3] overflow-hidden rounded-lg bg-muted ring-1 ring-white/10 transition duration-300 group-hover:-translate-y-1 group-hover:ring-primary/50">
                        {posterUrl ? (
                            <MediaImage
                                src={posterUrl}
                                alt={title}
                                fill
                                className="object-cover transition duration-500 group-hover:scale-105 group-hover:brightness-110"
                                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 18vw"
                                fallback={
                                    <div className="poster-surface flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                                        <Clapperboard />
                                        <span>الملصق غير متاح</span>
                                    </div>
                                }
                            />
                        ) : (
                            <div className="poster-surface flex h-full items-center justify-center text-sm text-muted-foreground">
                                بدون ملصق
                            </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/86 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                        {ratingNum && ratingNum > 0 && (
                            <Badge className="absolute start-2 top-2 gap-1 border-white/10 bg-black/70 text-white backdrop-blur">
                                <Star className="fill-primary text-primary" />
                                {ratingNum.toFixed(1)}
                            </Badge>
                        )}
                    </div>
                    <div className="border-b border-transparent pt-3 transition-colors group-hover:border-primary/40">
                        <h3 className="line-clamp-1 text-base font-semibold transition-colors group-hover:text-primary">
                            {title}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">{year}</p>
                    </div>
                </CardContent>
            </Card>
        </Link>
    )
}
