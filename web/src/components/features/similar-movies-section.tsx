"use client"

import * as React from "react"
import { api, type VectorSearchResult, type Genre } from "@/lib/api"
import { MovieCard } from "@/components/features/movie-card"
import { Skeleton } from "@/components/ui/skeleton"

interface SimilarMoviesSectionProps {
    slug: string
    year: number
    genres: Genre[]
}

export function SimilarMoviesSection({ slug, year, genres }: SimilarMoviesSectionProps) {
    const [movies, setMovies] = React.useState<VectorSearchResult[]>([])
    const [isLoading, setIsLoading] = React.useState(true)

    void year
    void genres

    React.useEffect(() => {
        const fetchSimilar = async () => {
            try {
                const data = await api.getSimilarMovies(slug)
                setMovies(data.results)
            } catch (error) {
                console.error("Failed to fetch similar movies:", error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchSimilar()
    }, [slug])

    if (!isLoading && movies.length === 0) {
        return null
    }

    return (
        <section data-pagefind-ignore className="mt-12">
            <h2 className="mb-6 text-2xl font-bold">أفلام مشابهة</h2>

            {isLoading ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="space-y-2">
                            <Skeleton className="aspect-[2/3] rounded-lg" />
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                    {movies.map(({ movie }) => (
                        <MovieCard
                            key={movie.id}
                            id={movie.id}
                            slug={movie.slug || movie.id}
                            title={movie.title || movie.title_ar || movie.title_en || 'Untitled'}
                            year={movie.year}
                            posterUrl={movie.poster_url}
                            rating={movie.rating}
                        />
                    ))}
                </div>
            )}
        </section>
    )
}
