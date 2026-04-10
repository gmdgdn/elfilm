"use client"

import { MediaPlayer, MediaProvider, Poster } from '@vidstack/react';
import { defaultLayoutIcons, DefaultVideoLayout } from '@vidstack/react/player/layouts/default';
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';

interface VideoPlayerProps {
    url: string;
    title?: string;
    poster?: string;
    embedUrl?: string | null;
    embedType?: string | null;
}

export function VideoPlayer({ url, title, poster, embedUrl, embedType }: VideoPlayerProps) {
    if (embedType === "iframe" && embedUrl) {
        return (
            <div className="aspect-video overflow-hidden rounded-md bg-slate-950 ring-1 ring-white/10">
                <iframe
                    src={embedUrl}
                    title={title || "مشغل الفيديو"}
                    className="h-full w-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    referrerPolicy="origin-when-cross-origin"
                />
            </div>
        )
    }

    return (
        <MediaPlayer title={title} src={url} className="w-full aspect-video bg-slate-900 text-white font-sans overflow-hidden rounded-md ring-media-focus data-[focus]:ring-4">
            <MediaProvider>
                {poster && <Poster className="vds-poster" src={poster} alt={title} />}
            </MediaProvider>
            <DefaultVideoLayout icons={defaultLayoutIcons} />
        </MediaPlayer>
    );
}
