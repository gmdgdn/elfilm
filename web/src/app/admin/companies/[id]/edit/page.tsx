"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { adminApi } from '@/lib/adminApi'

interface AdminCompany {
    id: string
    slug: string
    name_ar: string
    name_en?: string | null
    kind?: string | null
    country?: string | null
    founded_year?: number | string | null
    closed_year?: number | string | null
    description_ar?: string | null
}

export default function EditCompanyPage({ params }: { params: { id: string } }) {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState({
        id: '',
        slug: '',
        name_ar: '',
        name_en: '',
        kind: '',
        country: '',
        founded_year: '',
        closed_year: '',
        description_ar: '',
    })

    useEffect(() => {
        fetchCompany()
    }, [])

    const fetchCompany = async () => {
        try {
            // Temporary hack: fetch list and find
            const res = await adminApi.getCompanies({ limit: 1000 }) as { companies: AdminCompany[] }
            const company = res.companies.find((c) => c.id === params.id)

            if (company) {
                setFormData({
                    ...company,
                    name_en: company.name_en || '',
                    kind: company.kind || '',
                    country: company.country || '',
                    founded_year: company.founded_year ? String(company.founded_year) : '',
                    closed_year: company.closed_year ? String(company.closed_year) : '',
                    description_ar: company.description_ar || '',
                })
            } else {
                alert('Company not found')
                router.push('/admin/companies')
            }
        } catch (error) {
            console.error('Failed to fetch company:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)

        try {
            await adminApi.updateCompany(params.id, {
                ...formData,
                founded_year: formData.founded_year ? parseInt(String(formData.founded_year)) : null,
                closed_year: formData.closed_year ? parseInt(String(formData.closed_year)) : null,
            })
            router.push('/admin/companies')
        } catch (error: unknown) {
            console.error('Failed to update company:', error)
            const message = error instanceof Error ? error.message : 'Unknown error'
            alert(`Failed to update company: ${message}`)
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
                <h1 className="text-3xl font-bold">Edit Company</h1>
                <p className="text-muted-foreground mt-2">
                    Update company details
                </p>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Company Details</CardTitle>
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

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="kind">Type</Label>
                                    <Input
                                        id="kind"
                                        value={formData.kind}
                                        onChange={(e) => setFormData(prev => ({ ...prev, kind: e.target.value }))}
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
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="closed_year">Closed Year</Label>
                                    <Input
                                        id="closed_year"
                                        type="number"
                                        value={formData.closed_year}
                                        onChange={(e) => setFormData(prev => ({ ...prev, closed_year: e.target.value }))}
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
                                />
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
