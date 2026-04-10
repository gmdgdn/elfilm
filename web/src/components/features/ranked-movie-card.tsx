import Link from "next/link"
import { Clapperboard, Star } from "lucide-react"

import { MediaImage } from "@/components/features/media-image"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface RankedMovieCardProps {
    rank: number
    id?: string | null
    slug?: string | null
    title: string
    year: number | string
    director?: string | null
    posterUrl?: string | null
    rating?: number | string | null
    className?: string
}

function ratingLabel(value?: number | string | null) {
    const numeric = typeof value === "string" ? parseFloat(value) : value
    return numeric && numeric > 0 ? numeric.toFixed(1) : null
}

export function RankedMovieCard({
    rank,
    id,
    slug,
    title,
    year,
    director,
    posterUrl,
    rating,
    className,
}: RankedMovieCardProps) {
    const href = id ? `/movies/${slug || id}` : null
    const score = ratingLabel(rating)
    const content = (
        <article
            id={`rank-${rank}`}
            className={cn(
                "group flex h-full min-w-0 flex-col rounded-lg border bg-card/45 p-2 transition-colors hover:bg-card/80",
                className
            )}
        >
            <div className="poster-lift relative aspect-[2/3] overflow-hidden rounded-md bg-muted ring-1 ring-white/10">
                {posterUrl ? (
                    <MediaImage
                        src={posterUrl}
                        alt={title}
                        fill
                        className="object-cover transition duration-500 group-hover:scale-105 group-hover:brightness-110"
                        sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 150px"
                        fallback={
                            <div className="poster-surface flex h-full flex-col items-center justify-center gap-2 text-center text-xs text-muted-foreground">
                                <Clapperboard />
                                <span>الملصق غير متاح</span>
                            </div>
                        }
                    />
                ) : (
                    <div className="poster-surface flex h-full flex-col items-center justify-center gap-2 text-center text-xs text-muted-foreground">
                        <Clapperboard />
                        <span>الملصق غير متاح</span>
                    </div>
                )}
                <Badge className="absolute start-2 top-2 border-white/10 bg-black/75 text-white">
                    #{rank.toLocaleString("ar-EG")}
                </Badge>
                {score ? (
                    <Badge className="absolute bottom-2 start-2 gap-1 border-white/10 bg-black/75 text-white">
                        <Star className="fill-primary text-primary" />
                        {score}
                    </Badge>
                ) : null}
            </div>
            <div className="flex min-h-24 flex-col pt-3">
                <h3 className="line-clamp-2 text-sm font-semibold leading-6 transition-colors group-hover:text-primary">
                    {title}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">{year}</p>
                {director ? (
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{director}</p>
                ) : null}
                {!id ? (
                    <Badge variant="outline" className="mt-auto text-[0.68rem]">
                        غير مربوط
                    </Badge>
                ) : null}
            </div>
        </article>
    )

    return href ? (
        <Link href={href} className="block h-full rounded-lg">
            {content}
        </Link>
    ) : (
        <div className="h-full">{content}</div>
    )
}
