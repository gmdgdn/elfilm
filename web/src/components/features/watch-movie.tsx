"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PlayCircle } from "lucide-react"

interface WatchMovieProps {
    title: string
    year: number | string
    watchLinks: Array<{ platform: string, url: string, title?: string }>
}

export function WatchMovie({ title, year, watchLinks }: WatchMovieProps) {
    if (!watchLinks || watchLinks.length === 0) return null

    return (
        <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-bold flex items-center gap-2">
                <PlayCircle className="h-6 w-6 text-primary" />
                شاهد فيلم {title}
            </h2>

            <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                    مشاهدة فيلم {title} ({year}) بجودة عالية. روابط مشاهدة مباشرة ومجانية.
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                    {watchLinks.map((link, i) => (
                        <Button key={i} variant="outline" className="w-full justify-start gap-2" asChild>
                            <a href={link.url} target="_blank" rel="noopener noreferrer">
                                <PlayCircle className="h-4 w-4" />
                                {link.title || `Watch on ${link.platform}`}
                            </a>
                        </Button>
                    ))}
                </div>

                <div className="text-xs text-muted-foreground mt-4">
                    <p>كلمات دلالية: مشاهدة {title}, تحميل فيلم {title}, {title} كامل, فيلم {title} {year}</p>
                </div>
            </div>
        </div>
    )
}
