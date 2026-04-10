import { notFound } from "next/navigation"

import { WatchPageContent } from "@/components/features/watch-page-content"
import { api, type MovieWithRelations } from "@/lib/api"

interface WatchPageProps {
    params: Promise<{ slug: string }>
}

export default async function WatchPage({ params }: WatchPageProps) {
    const { slug } = await params
    const idMatch = slug.match(/EF-M-\d+/i)
    const id = idMatch?.[0] || slug

    if (!id) notFound()

    let movie: MovieWithRelations | null = null
    try {
        const response = await api.getMovie(id)
        movie = response.movie
    } catch (error) {
        console.error("Failed to load movie:", error)
        notFound()
    }

    if (!movie) notFound()

    return (
        <div className="container py-10">
            <WatchPageContent movie={movie} />
        </div>
    )
}
