"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { adminApi } from '@/lib/adminApi'

interface Company {
    id: string
    slug: string
    name_ar: string
    name_en: string | null
    kind: string | null
    country: string
    founded_year: number | null
}

export default function AdminCompaniesPage() {
    const [companies, setCompanies] = useState<Company[]>([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const limit = 50

    useEffect(() => {
        fetchCompanies()
    }, [page])

    const fetchCompanies = async () => {
        setLoading(true)
        try {
            const offset = (page - 1) * limit
            const res = await adminApi.getCompanies({ limit, offset }) as { companies: Company[] }
            setCompanies(res.companies || [])
        } catch (error) {
            console.error('Failed to fetch companies:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this company?')) {
            return
        }

        try {
            await adminApi.deleteCompany(id)
            fetchCompanies()
        } catch (error) {
            console.error('Failed to delete company:', error)
            alert('Failed to delete company')
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Companies</h1>
                    <p className="text-muted-foreground mt-2">
                        Manage production and distribution companies
                    </p>
                </div>
                <Link href="/admin/companies/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Company
                    </Button>
                </Link>
            </div>

            {/* Companies Table */}
            <div className="rounded-md border">
                <table className="w-full">
                    <thead>
                        <tr className="border-b bg-muted/50">
                            <th className="p-4 text-left font-medium">Name (Arabic)</th>
                            <th className="p-4 text-left font-medium">Name (English)</th>
                            <th className="p-4 text-left font-medium">Type</th>
                            <th className="p-4 text-left font-medium">Founded</th>
                            <th className="p-4 text-left font-medium">Country</th>
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
                        ) : companies.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                                    No companies found
                                </td>
                            </tr>
                        ) : (
                            companies.map((company) => (
                                <tr key={company.id} className="border-b hover:bg-muted/50">
                                    <td className="p-4">{company.name_ar}</td>
                                    <td className="p-4 text-muted-foreground">
                                        {company.name_en || '—'}
                                    </td>
                                    <td className="p-4 text-sm">{company.kind || '—'}</td>
                                    <td className="p-4">{company.founded_year || '—'}</td>
                                    <td className="p-4">{company.country}</td>
                                    <td className="p-4">
                                        <div className="flex justify-end gap-2">
                                            <Link href={`/admin/companies/${company.id}/edit`}>
                                                <Button variant="outline" size="sm">
                                                    Edit
                                                </Button>
                                            </Link>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => handleDelete(company.id)}
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
                    disabled={companies.length < limit}
                >
                    Next
                </Button>
            </div>
        </div>
    )
}
