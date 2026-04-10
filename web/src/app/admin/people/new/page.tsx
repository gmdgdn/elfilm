"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { adminApi } from '@/lib/adminApi'
import { ImageUpload } from '@/components/admin/image-upload'

export default function NewPersonPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        id: '',
        slug: '',
        name_ar: '',
        name_en: '',
        full_name: '',
        bio_ar: '',
        birthdate: '',
        deathdate: '',
        country: 'مصر',
        profile_image: '',
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            await adminApi.createPerson(formData)
            router.push('/admin/people')
        } catch (error: unknown) {
            console.error('Failed to create person:', error)
            const message = error instanceof Error ? error.message : 'Unknown error'
            alert(`Failed to create person: ${message}`)
        } finally {
            setLoading(false)
        }
    }

    const generateSlug = (name: string) => {
        return name
            .toLowerCase()
            .replace(/[^\u0620-\u064Aa-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim()
    }

    const handleNameChange = (name: string) => {
        setFormData(prev => ({
            ...prev,
            name_ar: name,
            slug: generateSlug(name),
            id: generateSlug(name) + '-' + Math.floor(Math.random() * 1000),
        }))
    }

    return (
        <div className="max-w-4xl space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Add New Person</h1>
                <p className="text-muted-foreground mt-2">
                    Add an actor, director, or crew member
                </p>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-[1fr_300px]">
                        <div className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Personal Information</CardTitle>
                                    <CardDescription>
                                        Basic details about the person
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="name_ar">Name (Arabic) *</Label>
                                            <Input
                                                id="name_ar"
                                                required
                                                value={formData.name_ar}
                                                onChange={(e) => handleNameChange(e.target.value)}
                                                placeholder="الاسم"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="name_en">Name (English)</Label>
                                            <Input
                                                id="name_en"
                                                value={formData.name_en}
                                                onChange={(e) => setFormData(prev => ({ ...prev, name_en: e.target.value }))}
                                                placeholder="Name"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="full_name">Full Name</Label>
                                        <Input
                                            id="full_name"
                                            value={formData.full_name}
                                            onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                                            placeholder="Full legal name"
                                        />
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="birthdate">Birthdate</Label>
                                            <Input
                                                id="birthdate"
                                                type="date"
                                                value={formData.birthdate}
                                                onChange={(e) => setFormData(prev => ({ ...prev, birthdate: e.target.value }))}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="deathdate">Deathdate</Label>
                                            <Input
                                                id="deathdate"
                                                type="date"
                                                value={formData.deathdate}
                                                onChange={(e) => setFormData(prev => ({ ...prev, deathdate: e.target.value }))}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="country">Country</Label>
                                        <Input
                                            id="country"
                                            value={formData.country}
                                            onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="bio">Biography (Arabic)</Label>
                                        <textarea
                                            id="bio"
                                            className="w-full min-h-32 rounded-md border bg-background px-3 py-2"
                                            value={formData.bio_ar}
                                            onChange={(e) => setFormData(prev => ({ ...prev, bio_ar: e.target.value }))}
                                            placeholder="السيرة الذاتية..."
                                        />
                                    </div>

                                </CardContent>
                            </Card>
                        </div>

                        <div className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Profile Image</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ImageUpload
                                        value={formData.profile_image}
                                        onChange={(url) => setFormData(prev => ({ ...prev, profile_image: url }))}
                                        onRemove={() => setFormData(prev => ({ ...prev, profile_image: '' }))}
                                    />
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>System Fields</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>ID</Label>
                                        <Input value={formData.id} disabled className="bg-muted" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Slug</Label>
                                        <Input value={formData.slug} disabled className="bg-muted" />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Creating...' : 'Create Person'}
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
