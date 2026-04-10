import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AdminShell } from '@/components/admin/admin-shell'
import { hasAdminSession } from '@/actions/admin'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
    title: 'Admin Dashboard | ElFilm',
    description: 'Manage ElFilm content and settings',
}

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    if (!(await hasAdminSession())) {
        notFound()
    }

    return <AdminShell>{children}</AdminShell>
}
