"use client"

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { adminApi } from '@/lib/adminApi'

interface Movie {
    id: string
    slug: string
    title_ar: string
    title_en: string | null
    year: number
    rating: number
    created_at: string
}

export default function AdminMoviesPage() {
    const [movies, setMovies] = useState<Movie[]>([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const limit = 50

    const fetchMovies = useCallback(async () => {
        setLoading(true)
        try {
            const offset = (page - 1) * limit

            const data = await adminApi.getMovies({
                limit,
                offset,
                orderBy: 'created_at',
                direction: 'DESC',
            }) as { movies: Movie[] }

            setMovies(data.movies || [])
        } catch (error) {
            console.error('Failed to fetch movies:', error)
        } finally {
            setLoading(false)
        }
    }, [page])

    useEffect(() => {
        void fetchMovies()
    }, [fetchMovies])

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this movie?')) {
            return
        }

        try {
            await adminApi.deleteMovie(id)
            await fetchMovies()
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete movie'
            console.error('Failed to delete movie:', message)
            alert(message)
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Movies</h1>
                    <p className="text-muted-foreground mt-2">
                        Manage all movies in the database
                    </p>
                </div>
                <Link href="/admin/movies/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Movie
                    </Button>
                </Link>
            </div>

            {/* Movies Table */}
            <div className="rounded-md border">
                <table className="w-full">
                    <thead>
                        <tr className="border-b bg-muted/50">
                            <th className="p-4 text-left font-medium">Title (Arabic)</th>
                            <th className="p-4 text-left font-medium">Title (English)</th>
                            <th className="p-4 text-left font-medium">Year</th>
                            <th className="p-4 text-left font-medium">Rating</th>
                            <th className="p-4 text-left font-medium">Added</th>
                            <th className="p-4 text-right font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                                    Loading...
                                </td>
                            </tr>
                        ) : movies.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                                    No movies found
                                </td>
                            </tr>
                        ) : (
                            movies.map((movie) => (
                                <tr key={movie.id} className="border-b hover:bg-muted/50">
                                    <td className="p-4">{movie.title_ar}</td>
                                    <td className="p-4 text-muted-foreground">
                                        {movie.title_en || '—'}
                                    </td>
                                    <td className="p-4">{movie.year}</td>
                                    <td className="p-4">{movie.rating || 0}</td>
                                    <td className="p-4 text-sm text-muted-foreground">
                                        {new Date(movie.created_at).toLocaleDateString('ar-EG')}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex justify-end gap-2">
                                            <Link href={`/admin/movies/${movie.id}/edit`}>
                                                <Button variant="outline" size="sm">
                                                    Edit
                                                </Button>
                                            </Link>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => handleDelete(movie.id)}
                                            >
                                                Delete
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-center gap-2">
                <Button
                    variant="outline"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                >
                    Previous
                </Button>
                <span className="px-4 text-sm">Page {page}</span>
                <Button
                    variant="outline"
                    onClick={() => setPage(p => p + 1)}
                    disabled={movies.length < limit}
                >
                    Next
                </Button>
            </div>
        </div>
    )
}
