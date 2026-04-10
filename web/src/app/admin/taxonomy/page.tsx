"use client"
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Trash2 } from 'lucide-react'
import { adminApi } from '@/lib/adminApi'

interface Genre {
    id: number
    slug: string
    name_ar: string
    name_en: string | null
    usage_count: number
}

interface Tag {
    id: number
    slug: string
    name_ar: string
    name_en: string | null
    category: string | null
    usage_count: number
}

export default function TaxonomyPage() {
    const [genres, setGenres] = useState<Genre[]>([])
    const [tags, setTags] = useState<Tag[]>([])

    // Genre form state
    const [genreForm, setGenreForm] = useState({ slug: '', name_ar: '', name_en: '' })

    // Tag form state
    const [tagForm, setTagForm] = useState({ slug: '', name_ar: '', name_en: '', category: '' })

    const fetchData = useCallback(async () => {
        try {
            const [genresRes, tagsRes] = await Promise.all([
                adminApi.getGenres() as Promise<{ genres: Genre[] }>,
                adminApi.getTags() as Promise<{ tags: Tag[] }>,
            ])

            setGenres(genresRes.genres || [])
            setTags(tagsRes.tags || [])
        } catch (error) {
            console.error('Failed to fetch taxonomy:', error)
        }
    }, [])

    useEffect(() => {
        void fetchData()
    }, [fetchData])

    // Genre handlers
    const handleCreateGenre = async () => {
        try {
            await adminApi.createGenre(genreForm)
            setGenreForm({ slug: '', name_ar: '', name_en: '' })
            await fetchData()
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create genre'
            console.error('Failed to create genre:', message)
            alert(message)
        }
    }

    const handleDeleteGenre = async (id: number) => {
        if (!confirm('Delete this genre?')) return

        try {
            await adminApi.deleteGenre(id)
            await fetchData()
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete genre'
            console.error('Failed to delete genre:', message)
            alert(message)
        }
    }

    // Tag handlers
    const handleCreateTag = async () => {
        try {
            await adminApi.createTag(tagForm)
            setTagForm({ slug: '', name_ar: '', name_en: '', category: '' })
            await fetchData()
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create tag'
            console.error('Failed to create tag:', message)
            alert(message)
        }
    }

    const handleDeleteTag = async (id: number) => {
        if (!confirm('Delete this tag?')) return

        try {
            await adminApi.deleteTag(id)
            await fetchData()
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete tag'
            console.error('Failed to delete tag:', message)
            alert(message)
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Taxonomy Management</h1>
                <p className="text-muted-foreground mt-2">
                    Manage genres and tags for categorizing content
                </p>
            </div>

            <Tabs defaultValue="genres" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="genres">Genres</TabsTrigger>
                    <TabsTrigger value="tags">Tags</TabsTrigger>
                </TabsList>

                {/* Genres Tab */}
                <TabsContent value="genres" className="space-y-4">
                    {/* Create Genre Form */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Create New Genre</CardTitle>
                            <CardDescription>Add a new genre to the system</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="space-y-2">
                                    <Label htmlFor="genre-slug">Slug</Label>
                                    <Input
                                        id="genre-slug"
                                        value={genreForm.slug}
                                        onChange={(e) => setGenreForm(prev => ({ ...prev, slug: e.target.value }))}
                                        placeholder="drama"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="genre-name-ar">Name (Arabic)</Label>
                                    <Input
                                        id="genre-name-ar"
                                        value={genreForm.name_ar}
                                        onChange={(e) => setGenreForm(prev => ({ ...prev, name_ar: e.target.value }))}
                                        placeholder="دراما"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="genre-name-en">Name (English)</Label>
                                    <Input
                                        id="genre-name-en"
                                        value={genreForm.name_en}
                                        onChange={(e) => setGenreForm(prev => ({ ...prev, name_en: e.target.value }))}
                                        placeholder="Drama"
                                    />
                                </div>
                            </div>
                            <Button onClick={handleCreateGenre} className="mt-4">
                                <Plus className="mr-2 h-4 w-4" />
                                Create Genre
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Genres List */}
                    <Card>
                        <CardHeader>
                            <CardTitle>All Genres ({genres.length})</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b bg-muted/50">
                                            <th className="p-3 text-left font-medium">Slug</th>
                                            <th className="p-3 text-left font-medium">Arabic Name</th>
                                            <th className="p-3 text-left font-medium">English Name</th>
                                            <th className="p-3 text-left font-medium">Usage</th>
                                            <th className="p-3 text-right font-medium">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {genres.map((genre) => (
                                            <tr key={genre.id} className="border-b hover:bg-muted/50">
                                                <td className="p-3 font-mono text-sm">{genre.slug}</td>
                                                <td className="p-3">{genre.name_ar}</td>
                                                <td className="p-3 text-muted-foreground">{genre.name_en || '—'}</td>
                                                <td className="p-3">{genre.usage_count} movies</td>
                                                <td className="p-3">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            onClick={() => handleDeleteGenre(genre.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tags Tab */}
                <TabsContent value="tags" className="space-y-4">
                    {/* Create Tag Form */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Create New Tag</CardTitle>
                            <CardDescription>Add a new tag to the system</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="tag-slug">Slug</Label>
                                    <Input
                                        id="tag-slug"
                                        value={tagForm.slug}
                                        onChange={(e) => setTagForm(prev => ({ ...prev, slug: e.target.value }))}
                                        placeholder="cairo"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="tag-category">Category</Label>
                                    <Input
                                        id="tag-category"
                                        value={tagForm.category}
                                        onChange={(e) => setTagForm(prev => ({ ...prev, category: e.target.value }))}
                                        placeholder="location"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="tag-name-ar">Name (Arabic)</Label>
                                    <Input
                                        id="tag-name-ar"
                                        value={tagForm.name_ar}
                                        onChange={(e) => setTagForm(prev => ({ ...prev, name_ar: e.target.value }))}
                                        placeholder="القاهرة"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="tag-name-en">Name (English)</Label>
                                    <Input
                                        id="tag-name-en"
                                        value={tagForm.name_en}
                                        onChange={(e) => setTagForm(prev => ({ ...prev, name_en: e.target.value }))}
                                        placeholder="Cairo"
                                    />
                                </div>
                            </div>
                            <Button onClick={handleCreateTag} className="mt-4">
                                <Plus className="mr-2 h-4 w-4" />
                                Create Tag
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Tags List */}
                    <Card>
                        <CardHeader>
                            <CardTitle>All Tags ({tags.length})</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b bg-muted/50">
                                            <th className="p-3 text-left font-medium">Slug</th>
                                            <th className="p-3 text-left font-medium">Arabic Name</th>
                                            <th className="p-3 text-left font-medium">English Name</th>
                                            <th className="p-3 text-left font-medium">Category</th>
                                            <th className="p-3 text-left font-medium">Usage</th>
                                            <th className="p-3 text-right font-medium">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tags.map((tag) => (
                                            <tr key={tag.id} className="border-b hover:bg-muted/50">
                                                <td className="p-3 font-mono text-sm">{tag.slug}</td>
                                                <td className="p-3">{tag.name_ar}</td>
                                                <td className="p-3 text-muted-foreground">{tag.name_en || '—'}</td>
                                                <td className="p-3 text-sm text-muted-foreground">{tag.category || '—'}</td>
                                                <td className="p-3">{tag.usage_count} movies</td>
                                                <td className="p-3">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            onClick={() => handleDeleteTag(tag.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
