"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { adminApi } from '@/lib/adminApi'

export default function NewMoviePage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        id: '',
        slug: '',
        title_ar: '',
        title_en: '',
        year: new Date().getFullYear(),
        type: '',
        duration_minutes: '',
        summary_ar: '',
        country: 'Egypt',
        language: 'Arabic',
        rating: 0,
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            await adminApi.createMovie({
                ...formData,
                duration_minutes: formData.duration_minutes ? parseInt(formData.duration_minutes) : null,
            })

            router.push('/admin/movies')
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create movie'
            console.error('Failed to create movie:', message)
            alert(message)
        } finally {
            setLoading(false)
        }
    }

    const generateSlug = (title: string) => {
        return title
            .toLowerCase()
            .replace(/[^\u0620-\u064Aa-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim()
    }

    const handleTitleChange = (title: string) => {
        setFormData(prev => ({
            ...prev,
            title_ar: title,
            slug: generateSlug(title),
            id: generateSlug(title) + '-' + prev.year,
        }))
    }

    return (
        <div className="max-w-4xl space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Add New Movie</h1>
                <p className="text-muted-foreground mt-2">
                    Create a new movie entry in the database
                </p>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="space-y-6">
                    {/* Basic Information */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Basic Information</CardTitle>
                            <CardDescription>
                                Essential movie details
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="title_ar">Title (Arabic) *</Label>
                                    <Input
                                        id="title_ar"
                                        required
                                        value={formData.title_ar}
                                        onChange={(e) => handleTitleChange(e.target.value)}
                                        placeholder="عنوان الفيلم"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="title_en">Title (English)</Label>
                                    <Input
                                        id="title_en"
                                        value={formData.title_en}
                                        onChange={(e) => setFormData(prev => ({ ...prev, title_en: e.target.value }))}
                                        placeholder="Movie Title"
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
                                        onChange={(e) => setFormData(prev => ({
                                            ...prev,
                                            year: parseInt(e.target.value),
                                            id: prev.slug + '-' + e.target.value
                                        }))}
                                        min="1920"
                                        max={new Date().getFullYear() + 5}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="duration">Duration (minutes)</Label>
                                    <Input
                                        id="duration"
                                        type="number"
                                        value={formData.duration_minutes}
                                        onChange={(e) => setFormData(prev => ({ ...prev, duration_minutes: e.target.value }))}
                                        placeholder="90"
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
                                        placeholder="Color, Black and White"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="rating">Rating</Label>
                                    <Input
                                        id="rating"
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="10"
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
                                    placeholder="ملخص القصة..."
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

                    {/* Auto-generated Fields */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Auto-generated Fields</CardTitle>
                            <CardDescription>
                                These are generated automatically
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Movie ID</Label>
                                <Input value={formData.id} disabled className="bg-muted" />
                            </div>
                            <div className="space-y-2">
                                <Label>Slug</Label>
                                <Input value={formData.slug} disabled className="bg-muted" />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Actions */}
                    <div className="flex gap-4">
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Creating...' : 'Create Movie'}
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
