"use client"

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { adminApi } from '@/lib/adminApi'

interface Person {
    id: string
    slug: string
    name_ar: string
    name_en: string | null
    birthdate: string | null
    created_at: string
}

export default function AdminPeoplePage() {
    const [people, setPeople] = useState<Person[]>([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const limit = 50

    const fetchPeople = useCallback(async () => {
        setLoading(true)
        try {
            const offset = (page - 1) * limit

            const data = await adminApi.getPeople({
                limit,
                offset,
            }) as { people: Person[] }

            setPeople(data.people || [])
        } catch (error) {
            console.error('Failed to fetch people:', error)
        } finally {
            setLoading(false)
        }
    }, [page])

    useEffect(() => {
        void fetchPeople()
    }, [fetchPeople])

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this person? This will also remove all their movie credits.')) {
            return
        }

        try {
            await adminApi.deletePerson(id)
            await fetchPeople()
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete person'
            console.error('Failed to delete person:', message)
            alert(message)
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">People</h1>
                    <p className="text-muted-foreground mt-2">
                        Manage actors, directors, and crew members
                    </p>
                </div>
                <Link href="/admin/people/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Person
                    </Button>
                </Link>
            </div>

            {/* People Table */}
            <div className="rounded-md border">
                <table className="w-full">
                    <thead>
                        <tr className="border-b bg-muted/50">
                            <th className="p-4 text-left font-medium">Name (Arabic)</th>
                            <th className="p-4 text-left font-medium">Name (English)</th>
                            <th className="p-4 text-left font-medium">Birthdate</th>
                            <th className="p-4 text-left font-medium">Added</th>
                            <th className="p-4 text-right font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                                    Loading...
                                </td>
                            </tr>
                        ) : people.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                                    No people found
                                </td>
                            </tr>
                        ) : (
                            people.map((person) => (
                                <tr key={person.id} className="border-b hover:bg-muted/50">
                                    <td className="p-4">{person.name_ar}</td>
                                    <td className="p-4 text-muted-foreground">
                                        {person.name_en || '—'}
                                    </td>
                                    <td className="p-4">
                                        {person.birthdate || '—'}
                                    </td>
                                    <td className="p-4 text-sm text-muted-foreground">
                                        {new Date(person.created_at).toLocaleDateString('ar-EG')}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex justify-end gap-2">
                                            <Link href={`/admin/people/${person.id}/edit`}>
                                                <Button variant="outline" size="sm">
                                                    Edit
                                                </Button>
                                            </Link>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => handleDelete(person.id)}
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
                    disabled={people.length < limit}
                >
                    Next
                </Button>
            </div>
        </div>
    )
}
