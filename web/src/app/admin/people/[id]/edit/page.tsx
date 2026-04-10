"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { adminApi } from '@/lib/adminApi'
import { ImageUpload } from '@/components/admin/image-upload'

interface AdminPerson {
    id: string
    slug: string
    name_ar: string
    name_en?: string | null
    full_name?: string | null
    bio_ar?: string | null
    birthdate?: string | null
    deathdate?: string | null
    country?: string | null
    profile_image?: string | null
}

export default function EditPersonPage({ params }: { params: { id: string } }) {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState({
        id: '',
        slug: '',
        name_ar: '',
        name_en: '',
        full_name: '',
        bio_ar: '',
        birthdate: '',
        deathdate: '',
        country: '',
        profile_image: '',
    })

    useEffect(() => {
        fetchPerson()
    }, [])

    const fetchPerson = async () => {
        try {
            // Temporary hack: fetch list and find
            const res = await adminApi.getPeople({ limit: 1000 }) as { people: AdminPerson[] }
            const person = res.people.find((p) => p.id === params.id)

            if (person) {
                setFormData({
                    ...person,
                    name_en: person.name_en || '',
                    full_name: person.full_name || '',
                    bio_ar: person.bio_ar || '',
                    birthdate: person.birthdate || '',
                    deathdate: person.deathdate || '',
                    country: person.country || '',
                    profile_image: person.profile_image || '',
                })
            } else {
                alert('Person not found')
                router.push('/admin/people')
            }
        } catch (error) {
            console.error('Failed to fetch person:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)

        try {
            await adminApi.updatePerson(params.id, formData)
            router.push('/admin/people')
        } catch (error: unknown) {
            console.error('Failed to update person:', error)
            const message = error instanceof Error ? error.message : 'Unknown error'
            alert(`Failed to update person: ${message}`)
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
                <h1 className="text-3xl font-bold">Edit Person</h1>
                <p className="text-muted-foreground mt-2">
                    Update person details
                </p>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-[1fr_300px]">
                        <div className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Personal Information</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="name_ar">Name (Arabic) *</Label>
                                            <Input
                                                id="name_ar"
                                                required
                                                value={formData.name_ar}
                                                onChange={(e) => setFormData(prev => ({ ...prev, name_ar: e.target.value }))}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="name_en">Name (English)</Label>
                                            <Input
                                                id="name_en"
                                                value={formData.name_en}
                                                onChange={(e) => setFormData(prev => ({ ...prev, name_en: e.target.value }))}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="full_name">Full Name</Label>
                                        <Input
                                            id="full_name"
                                            value={formData.full_name}
                                            onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
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
                        </div>
                    </div>

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
