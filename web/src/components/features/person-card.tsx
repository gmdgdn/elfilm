import Link from "next/link"
import { UserRound } from "lucide-react"

import { MediaImage } from "@/components/features/media-image"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface PersonCardProps {
    id: string
    slug: string
    name: string
    role?: string
    imageUrl?: string | null
    className?: string
}

export function PersonCard({
    id,
    slug,
    name,
    role,
    imageUrl,
    className,
}: PersonCardProps) {
    return (
        <Link href={`/people/${slug || id}`} className={cn("group block rounded-md", className)}>
            <Card className="overflow-hidden border-0 bg-transparent py-0 shadow-none">
                <CardContent className="p-0">
                    <div className="poster-lift relative aspect-[2/3] overflow-hidden rounded-lg bg-muted ring-1 ring-white/10 transition duration-300 group-hover:-translate-y-1 group-hover:ring-primary/50">
                        {imageUrl ? (
                            <MediaImage
                                src={imageUrl}
                                alt={name}
                                fill
                                className="object-cover transition duration-500 group-hover:scale-105 group-hover:brightness-110"
                                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 18vw"
                                fallback={
                                    <div className="poster-surface flex h-full items-center justify-center text-muted-foreground">
                                        <UserRound />
                                    </div>
                                }
                            />
                        ) : (
                            <div className="poster-surface flex h-full items-center justify-center text-muted-foreground">
                                <UserRound />
                            </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/82 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    <div className="border-b border-transparent pt-3 transition-colors group-hover:border-primary/40">
                        <h3 className="line-clamp-1 text-base font-semibold transition-colors group-hover:text-primary">
                            {name}
                        </h3>
                        {role && (
                            <p className="mt-1 text-sm text-muted-foreground">{role}</p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </Link>
    )
}
