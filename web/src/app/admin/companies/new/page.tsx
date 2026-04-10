"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { adminApi } from '@/lib/adminApi'

export default function NewCompanyPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        id: '',
        slug: '',
        name_ar: '',
        name_en: '',
        kind: '',
        country: 'مصر',
        founded_year: '',
        closed_year: '',
        description_ar: '',
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            await adminApi.createCompany({
                ...formData,
                founded_year: formData.founded_year ? parseInt(formData.founded_year) : null,
                closed_year: formData.closed_year ? parseInt(formData.closed_year) : null,
            })
            router.push('/admin/companies')
        } catch (error: unknown) {
            console.error('Failed to create company:', error)
            const message = error instanceof Error ? error.message : 'Unknown error'
            alert(`Failed to create company: ${message}`)
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
                <h1 className="text-3xl font-bold">Add New Company</h1>
                <p className="text-muted-foreground mt-2">
                    Create a new production or distribution company
                </p>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Company Details</CardTitle>
                            <CardDescription>
                                Basic information about the company
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
                                        placeholder="اسم الشركة"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="name_en">Name (English)</Label>
                                    <Input
                                        id="name_en"
                                        value={formData.name_en}
                                        onChange={(e) => setFormData(prev => ({ ...prev, name_en: e.target.value }))}
                                        placeholder="Company Name"
                                    />
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="kind">Type</Label>
                                    <Input
                                        id="kind"
                                        value={formData.kind}
                                        onChange={(e) => setFormData(prev => ({ ...prev, kind: e.target.value }))}
                                        placeholder="Production, Distribution, etc."
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="country">Country</Label>
                                    <Input
                                        id="country"
                                        value={formData.country}
                                        onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="founded_year">Founded Year</Label>
                                    <Input
                                        id="founded_year"
                                        type="number"
                                        value={formData.founded_year}
                                        onChange={(e) => setFormData(prev => ({ ...prev, founded_year: e.target.value }))}
                                        placeholder="1950"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="closed_year">Closed Year</Label>
                                    <Input
                                        id="closed_year"
                                        type="number"
                                        value={formData.closed_year}
                                        onChange={(e) => setFormData(prev => ({ ...prev, closed_year: e.target.value }))}
                                        placeholder="2000"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description">Description (Arabic)</Label>
                                <textarea
                                    id="description"
                                    className="w-full min-h-32 rounded-md border bg-background px-3 py-2"
                                    value={formData.description_ar}
                                    onChange={(e) => setFormData(prev => ({ ...prev, description_ar: e.target.value }))}
                                    placeholder="نبذة عن الشركة..."
                                />
                            </div>

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

                    <div className="flex gap-4">
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Creating...' : 'Create Company'}
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
