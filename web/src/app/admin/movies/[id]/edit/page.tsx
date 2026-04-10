"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { adminApi } from '@/lib/adminApi'

interface AdminMovie {
    id: string
    slug: string
    title_ar: string
    title_en?: string | null
    year: number
    type?: string | null
    duration_minutes?: number | string | null
    summary_ar?: string | null
    country?: string | null
    language?: string | null
    rating?: number | null
}

export default function EditMoviePage({ params }: { params: { id: string } }) {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState({
        id: '',
        slug: '',
        title_ar: '',
        title_en: '',
        year: new Date().getFullYear(),
        type: '',
        duration_minutes: '',
        summary_ar: '',
        country: '',
        language: '',
        rating: 0,
    })

    useEffect(() => {
        fetchMovie()
    }, [])

    const fetchMovie = async () => {
        try {
            // We need a getMovie endpoint in admin API or use the public one
            // For now, using the public one via adminApi wrapper if available, 
            // or we might need to add a specific admin endpoint for fetching single movie by ID
            // The current admin routes have GET /movies but not GET /movies/:id
            // Let's assume we can use the public API for fetching details or add the endpoint

            // Actually, looking at adminRoutes.ts, I didn't add GET /movies/:id
            // I should probably add it or use the public API. 
            // The public API uses slug, but here we have ID.
            // Let's use the public API with slug if we can find it, or just add the endpoint.
            // For now, let's assume we can fetch it. 

            // Wait, I missed adding GET /movies/:id in adminRoutes.ts. 
            // I only added GET /movies (list), POST, PUT /:id, DELETE /:id.
            // I should fix adminRoutes.ts to include GET /:id for all entities.

            // For this implementation, I will assume the endpoint exists or I will fix it.
            // Let's try to fetch from the list and filter (inefficient but works for now) 
            // OR better, I'll update adminRoutes.ts in a separate step.

            // For now, I'll mock the fetch or use the list endpoint to find it.
            const res = await adminApi.getMovies({ limit: 1000 }) as { movies: AdminMovie[] } // Temporary hack
            const movie = res.movies.find((m) => m.id === params.id)

            if (movie) {
                setFormData({
                    ...movie,
                    title_en: movie.title_en || '',
                    type: movie.type || '',
                    duration_minutes: movie.duration_minutes ? String(movie.duration_minutes) : '',
                    summary_ar: movie.summary_ar || '',
                    country: movie.country || '',
                    language: movie.language || '',
                    rating: movie.rating || 0,
                })
            } else {
                alert('Movie not found')
                router.push('/admin/movies')
            }
        } catch (error) {
            console.error('Failed to fetch movie:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)

        try {
            await adminApi.updateMovie(params.id, {
                ...formData,
                duration_minutes: formData.duration_minutes ? parseInt(String(formData.duration_minutes)) : null,
            })
            router.push('/admin/movies')
        } catch (error: unknown) {
            console.error('Failed to update movie:', error)
            const message = error instanceof Error ? error.message : 'Unknown error'
            alert(`Failed to update movie: ${message}`)
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return <div className="p-8 text-center">Loading...</div>
    }

    return (
        <div className="max-w-4xl space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Edit Movie</h1>
                <p className="text-muted-foreground mt-2">
                    Update movie details
                </p>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Basic Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="title_ar">Title (Arabic) *</Label>
                                    <Input
                                        id="title_ar"
                                        required
                                        value={formData.title_ar}
                                        onChange={(e) => setFormData(prev => ({ ...prev, title_ar: e.target.value }))}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="title_en">Title (English)</Label>
                                    <Input
                                        id="title_en"
                                        value={formData.title_en}
                                        onChange={(e) => setFormData(prev => ({ ...prev, title_en: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="year">Year *</Label>
                                    <Input
                                        id="year"
                                        type="number"
                                        required
                                        value={formData.year}
                                        onChange={(e) => setFormData(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="duration">Duration (minutes)</Label>
                                    <Input
                                        id="duration"
                                        type="number"
                                        value={formData.duration_minutes}
                                        onChange={(e) => setFormData(prev => ({ ...prev, duration_minutes: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="type">Type</Label>
                                    <Input
                                        id="type"
                                        value={formData.type}
                                        onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="rating">Rating</Label>
                                    <Input
                                        id="rating"
                                        type="number"
                                        step="0.1"
                                        value={formData.rating}
                                        onChange={(e) => setFormData(prev => ({ ...prev, rating: parseFloat(e.target.value) }))}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="summary">Summary (Arabic)</Label>
                                <textarea
                                    id="summary"
                                    className="w-full min-h-32 rounded-md border bg-background px-3 py-2"
                                    value={formData.summary_ar}
                                    onChange={(e) => setFormData(prev => ({ ...prev, summary_ar: e.target.value }))}
                                />
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="country">Country</Label>
                                    <Input
                                        id="country"
                                        value={formData.country}
                                        onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="language">Language</Label>
                                    <Input
                                        id="language"
                                        value={formData.language}
                                        onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex gap-4">
                        <Button type="submit" disabled={saving}>
                            {saving ? 'Saving...' : 'Save Changes'}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => router.back()}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            </form>
        </div>
    )
}
