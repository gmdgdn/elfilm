"use client"

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { adminApi } from '@/lib/adminApi'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface AuditLogEntry {
    id: number
    user_id: string | null
    action: 'create' | 'update' | 'delete'
    entity_type: string
    entity_id: string
    details: string | null
    created_at: string
}

export default function AuditLogPage() {
    const [logs, setLogs] = useState<AuditLogEntry[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchLogs()
    }, [])

    const fetchLogs = async () => {
        try {
            const res = await adminApi.getAuditLog({ limit: 100 }) as { logs: AuditLogEntry[] }
            setLogs(res.logs || [])
        } catch (error) {
            console.error('Failed to fetch audit logs:', error)
        } finally {
            setLoading(false)
        }
    }

    const getActionColor = (action: string) => {
        switch (action) {
            case 'create': return 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
            case 'update': return 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20'
            case 'delete': return 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
            default: return 'bg-gray-500/10 text-gray-500'
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Audit Log</h1>
                <p className="text-muted-foreground mt-2">
                    Track system activity and changes
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Time</TableHead>
                                    <TableHead>Action</TableHead>
                                    <TableHead>Entity Type</TableHead>
                                    <TableHead>Entity ID</TableHead>
                                    <TableHead>Details</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center h-24">
                                            Loading...
                                        </TableCell>
                                    </TableRow>
                                ) : logs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center h-24">
                                            No activity recorded
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    logs.map((log) => (
                                        <TableRow key={log.id}>
                                            <TableCell className="whitespace-nowrap">
                                                {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={getActionColor(log.action)}>
                                                    {log.action.toUpperCase()}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="capitalize">{log.entity_type}</TableCell>
                                            <TableCell className="font-mono text-xs">{log.entity_id}</TableCell>
                                            <TableCell className="max-w-[300px] truncate text-muted-foreground text-xs font-mono">
                                                {log.details}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
