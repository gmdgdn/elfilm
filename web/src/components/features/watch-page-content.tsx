"use client"

import Link from "next/link"
import { useState } from "react"
import { ExternalLink, MonitorPlay, PlayCircle } from "lucide-react"

import { MediaImage } from "@/components/features/media-image"
import { VideoPlayer } from "@/components/features/video-player"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { MovieWithRelations, WatchLink } from "@/lib/api"

interface WatchPageContentProps {
    movie: MovieWithRelations
}

function formatArabicDate(value?: string | null) {
    if (!value) return null
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("ar-EG")
}

function watchSourceLabel(value?: string | null) {
    switch (value) {
        case "exa":
            return "بحث Exa"
        case "youtube-search":
            return "بحث يوتيوب"
        case "manual":
            return "مصدر يدوي"
        default:
            return value || null
    }
}

export function WatchPageContent({ movie }: WatchPageContentProps) {
    const [selectedLink, setSelectedLink] = useState<WatchLink | null>(movie.watch_links?.[0] || null)
    const title = movie.title || movie.title_ar || "فيلم"
    const canEmbed = selectedLink && (selectedLink.embed_type === "iframe" || selectedLink.embed_type === "direct")
    const verifiedAtLabel = selectedLink?.verified_at
        ? formatArabicDate(selectedLink.verified_at)
        : null

    return (
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
            <div className="flex flex-col gap-8">
                {selectedLink ? (
                    <div className="flex flex-col gap-4">
                        {canEmbed ? (
                            <VideoPlayer
                                url={selectedLink.url}
                                title={title}
                                poster={movie.poster_url || undefined}
                                embedUrl={selectedLink.embed_url}
                                embedType={selectedLink.embed_type}
                            />
                        ) : (
                            <div className="flex aspect-video flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-card/40 p-6 text-center">
                                <MonitorPlay className="text-primary" />
                                <div>
                                    <p className="font-medium">هذا المصدر متاح كرابط خارجي</p>
                                    <p className="mt-2 text-sm text-muted-foreground">يمكننا عرضه هنا فقط عندما يوفر المزوّد تضمينا مباشرا أو ملف فيديو قابلا للتشغيل.</p>
                                </div>
                                <Button asChild>
                                    <a href={selectedLink.url} target="_blank" rel="noopener noreferrer">
                                        افتح المصدر
                                        <ExternalLink data-icon="inline-end" />
                                    </a>
                                </Button>
                            </div>
                        )}
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card/55 p-4">
                            <div className="flex items-center gap-2">
                                <MonitorPlay className="text-primary" />
                                <span className="font-medium">المصدر الحالي</span>
                                <span className="text-sm text-muted-foreground">{selectedLink.title || selectedLink.platform}</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Badge variant="outline">{selectedLink.platform}</Badge>
                                {selectedLink.is_official ? (
                                    <Badge variant="secondary">مصدر رسمي</Badge>
                                ) : null}
                                {selectedLink.source_kind ? (
                                    <Badge variant="outline">{watchSourceLabel(selectedLink.source_kind)}</Badge>
                                ) : null}
                                {selectedLink.confidence ? (
                                    <Badge variant="secondary">موثوقية {Math.round(selectedLink.confidence * 100)}%</Badge>
                                ) : null}
                                {verifiedAtLabel ? (
                                    <Badge variant="outline">تحقق {verifiedAtLabel}</Badge>
                                ) : null}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed bg-card/40">
                        <div className="text-center">
                            <PlayCircle className="mx-auto mb-3 text-muted-foreground" />
                            <p className="text-muted-foreground">اختر مصدرا لبدء المشاهدة</p>
                        </div>
                    </div>
                )}

                <div>
                    <Badge variant="outline" className="mb-4">المشاهدة</Badge>
                    <h1 className="text-4xl font-bold">{title} <span className="text-muted-foreground">({movie.year})</span></h1>
                    {(movie.story || movie.summary_ar) && (
                        <p className="mt-5 max-w-3xl text-lg leading-9 text-muted-foreground">{movie.story || movie.summary_ar}</p>
                    )}
                    <div className="mt-6 flex flex-wrap gap-3">
                        <Button asChild variant="outline">
                            <Link href={`/movies/${movie.slug || movie.id}`}>العودة إلى صفحة الفيلم</Link>
                        </Button>
                        {selectedLink ? (
                            <Button asChild>
                                <a href={selectedLink.url} target="_blank" rel="noopener noreferrer">
                                    افتح المصدر الخارجي
                                    <ExternalLink data-icon="inline-end" />
                                </a>
                            </Button>
                        ) : null}
                    </div>
                </div>
            </div>

            <aside className="flex flex-col gap-6">
                <Card className="bg-card/55">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <PlayCircle className="text-primary" />
                            مصادر المشاهدة
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                        {movie.watch_links && movie.watch_links.length > 0 ? (
                            movie.watch_links.map((link: WatchLink) => (
                                <Button
                                    key={link.id || link.url}
                                    variant={selectedLink?.url === link.url ? "default" : "outline"}
                                    className="h-auto justify-start py-3"
                                    onClick={() => setSelectedLink(link)}
                                >
                                    <PlayCircle />
                                    <span className="flex flex-col items-start">
                                        <span className="font-medium">{link.platform}</span>
                                        {link.title && <span className="text-xs opacity-80">{link.title}</span>}
                                    </span>
                                </Button>
                            ))
                        ) : (
                            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                                لا توجد روابط مشاهدة متاحة حاليا.
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="overflow-hidden rounded-lg border bg-muted">
                    <MediaImage
                        src={movie.poster_url || "/placeholder-movie.jpg"}
                        alt={title}
                        width={320}
                        height={480}
                        className="aspect-[2/3] w-full object-cover"
                        fallback={<div className="aspect-[2/3] w-full bg-muted" />}
                    />
                </div>
            </aside>
        </div>
    )
}
