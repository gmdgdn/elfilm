import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Star } from "lucide-react"

interface FeaturedItem {
    id: string
    slug: string
    title: string
    image: string
    subtitle?: string
    rating?: number
    type: 'movie' | 'person'
}

interface FeaturedSectionProps {
    title: string
    items: FeaturedItem[]
    linkHref?: string
    linkText?: string
}

export function FeaturedSection({ title, items, linkHref, linkText }: FeaturedSectionProps) {
    if (!items || items.length === 0) return null

    return (
        <section className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">{title}</h2>
                {linkHref && linkText && (
                    <Link href={linkHref} className="text-sm text-primary hover:underline">
                        {linkText}
                    </Link>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {items.map((item) => (
                    <Link
                        key={item.id}
                        href={`/${item.type === 'movie' ? 'movies' : 'people'}/${item.slug}`}
                        className="group"
                    >
                        <Card className="overflow-hidden border-0 bg-transparent transition-all hover:scale-[1.02]">
                            <CardContent className="p-0">
                                <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted">
                                    {item.image ? (
                                        <img
                                            src={item.image}
                                            alt={item.title}
                                            className="h-full w-full object-cover transition-all group-hover:brightness-110"
                                        />
                                    ) : (
                                        <div className="flex h-full items-center justify-center text-muted-foreground">
                                            <span className="text-4xl">{item.type === 'movie' ? '🎬' : '👤'}</span>
                                        </div>
                                    )}
                                    {item.rating && (
                                        <div className="absolute top-2 right-2">
                                            <Badge variant="secondary" className="flex items-center gap-1 bg-black/60 text-white backdrop-blur-sm">
                                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                                {item.rating.toFixed(1)}
                                            </Badge>
                                        </div>
                                    )}
                                </div>
                                <div className="mt-2 space-y-1">
                                    <h3 className="line-clamp-1 font-semibold group-hover:text-primary">
                                        {item.title}
                                    </h3>
                                    {item.subtitle && (
                                        <p className="text-xs text-muted-foreground">
                                            {item.subtitle}
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        </section>
    )
}
