"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, Play, Database } from 'lucide-react'
import { adminApi, type VectorIndexInfo } from '@/lib/adminApi'

export default function VectorizePage() {
    const [status, setStatus] = useState<VectorIndexInfo | null>(null)
    const [loading, setLoading] = useState(false)
    const [generating, setGenerating] = useState(false)
    const [progress, setProgress] = useState(0)
    const [logs, setLogs] = useState<string[]>([])

    useEffect(() => {
        fetchStatus()
    }, [])

    const fetchStatus = async () => {
        setLoading(true)
        try {
            const data = await adminApi.getVectorStatus()
            setStatus(data.info)
        } catch (error) {
            console.error('Failed to fetch status:', error)
            addLog('Failed to fetch index status')
        } finally {
            setLoading(false)
        }
    }

    const addLog = (message: string) => {
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev.slice(0, 49)])
    }

    const handleGenerate = async () => {
        if (!confirm('This will generate embeddings for movies that have summaries. Continue?')) {
            return
        }

        setGenerating(true)
        setProgress(0)
        addLog('Starting embedding generation...')

        try {
            const limit = 50
            let hasMore = true
            let afterId: string | null = null
            let totalProcessed = 0
            let totalErrors = 0

            while (hasMore) {
                const data = await adminApi.generateEmbeddings(limit, afterId)

                totalProcessed += data.processed
                totalErrors += data.errors
                afterId = data.nextAfterId || null
                hasMore = data.hasMore

                addLog(`Processed batch: ${data.processed} movies (${data.errors} errors)`)

                setProgress(prev => Math.min(prev + 10, 90))

                if (!hasMore) {
                    setProgress(100)
                    addLog(`Completed! Total processed: ${totalProcessed}, Errors: ${totalErrors}`)
                    fetchStatus()
                }
            }
        } catch (error) {
            console.error('Generation failed:', error)
            addLog('Generation failed. Check console for details.')
        } finally {
            setGenerating(false)
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Vector Search</h1>
                <p className="text-muted-foreground mt-2">
                    Manage semantic search index and embeddings
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Database className="h-5 w-5" />
                            Index Status
                        </CardTitle>
                        <CardDescription>
                            Current state of the Vectorize index
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {loading ? (
                            <div>Loading status...</div>
                        ) : status ? (
                            <div className="space-y-2">
                                <div className="flex justify-between py-2 border-b">
                                    <span className="font-medium">Vector Count</span>
                                    <Badge variant="secondary">{String(status.vectorCount ?? "0")}</Badge>
                                </div>
                                <div className="flex justify-between py-2 border-b">
                                    <span className="font-medium">Dimensions</span>
                                    <Badge variant="outline">{String(status.dimensions ?? "0")}</Badge>
                                </div>
                                <div className="flex justify-between py-2 border-b">
                                    <span className="font-medium">Namespace</span>
                                    <span className="text-sm text-muted-foreground">default</span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-red-500">Failed to load status</div>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={fetchStatus}
                            disabled={loading}
                        >
                            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh Status
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Actions</CardTitle>
                        <CardDescription>
                            Manage embeddings generation
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <h3 className="font-medium">Generate Embeddings</h3>
                            <p className="text-sm text-muted-foreground">
                                Generate vector embeddings for movies with Arabic summaries.
                                This process runs in batches.
                            </p>
                        </div>

                        {generating && (
                            <div className="space-y-2">
                                <Progress value={progress} />
                                <p className="text-xs text-center text-muted-foreground">
                                    Processing...
                                </p>
                            </div>
                        )}

                        <Button
                            onClick={handleGenerate}
                            disabled={generating || loading}
                            className="w-full"
                        >
                            {generating ? (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Play className="mr-2 h-4 w-4" />
                                    Start Generation
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Activity Log</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[200px] overflow-y-auto rounded-md border bg-muted/50 p-4 font-mono text-xs">
                        {logs.length === 0 ? (
                            <span className="text-muted-foreground">No activity yet</span>
                        ) : (
                            logs.map((log, i) => (
                                <div key={i} className="mb-1 last:mb-0">
                                    {log}
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
