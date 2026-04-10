import { Button } from "@/components/ui/button"
import { ExternalLink, PlayCircle } from "lucide-react"

interface WatchLink {
    platform: string
    url: string
    title?: string
}

interface WatchLinksProps {
    links: WatchLink[]
}

export function WatchLinks({ links }: WatchLinksProps) {
    if (!links || links.length === 0) return null

    const getPlatformIcon = (platform: string) => {
        // Simple mapping for now, could be expanded with real logos
        switch (platform.toLowerCase()) {
            case 'youtube': return '▶️'
            case 'netflix': return 'N'
            case 'shahid': return 'S'
            case 'watchit': return 'W'
            default: return '📺'
        }
    }

    return (
        <section className="space-y-4 rounded-lg border bg-card p-6">
            <h3 className="flex items-center gap-2 text-xl font-bold">
                <PlayCircle className="h-5 w-5 text-primary" />
                شاهد الآن
            </h3>

            <div className="grid gap-3 sm:grid-cols-2">
                {links.map((link, index) => (
                    <Button
                        key={index}
                        variant="outline"
                        className="h-auto justify-between py-4 text-right"
                        asChild
                    >
                        <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group"
                        >
                            <span className="flex items-center gap-2">
                                <span className="text-xl">{getPlatformIcon(link.platform)}</span>
                                <span className="font-semibold">{link.platform}</span>
                            </span>
                            <ExternalLink className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                        </a>
                    </Button>
                ))}
            </div>
        </section>
    )
}
