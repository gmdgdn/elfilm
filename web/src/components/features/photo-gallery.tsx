"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { X, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Photo {
    src: string
    alt: string
    width?: number
    height?: number
    type: 'poster' | 'still' | 'behind-the-scenes'
}

interface PhotoGalleryProps {
    photos: Photo[]
    title?: string
}

export function PhotoGallery({ photos, title = "معرض الصور" }: PhotoGalleryProps) {
    const [currentPhotoIndex, setCurrentPhotoIndex] = React.useState(0)
    const [isOpen, setIsOpen] = React.useState(false)

    if (!photos || photos.length === 0) return null

    const showNext = () => {
        setCurrentPhotoIndex((prev) => (prev + 1) % photos.length)
    }

    const showPrev = () => {
        setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowRight') showPrev() // RTL: Right arrow goes to previous (visually left)
        if (e.key === 'ArrowLeft') showNext()  // RTL: Left arrow goes to next (visually right)
    }

    return (
        <section className="space-y-4">
            <h3 className="text-2xl font-bold">{title}</h3>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {photos.slice(0, 10).map((photo, index) => (
                    <Dialog key={index} onOpenChange={(open) => {
                        setIsOpen(open)
                        if (open) setCurrentPhotoIndex(index)
                    }}>
                        <DialogTrigger asChild>
                            <div className={cn(
                                "relative cursor-pointer overflow-hidden rounded-lg bg-muted transition-all hover:opacity-90",
                                photo.type === 'poster' ? "aspect-[2/3]" : "aspect-video"
                            )}>
                                <img
                                    src={photo.src}
                                    alt={photo.alt}
                                    className="h-full w-full object-cover"
                                />
                            </div>
                        </DialogTrigger>
                        <DialogContent
                            className="max-w-screen-lg border-none bg-transparent p-0 shadow-none"
                            onKeyDown={handleKeyDown}
                        >
                            <div className="relative flex h-[80vh] w-full items-center justify-center">
                                {/* Close Button */}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute -top-10 right-0 text-white hover:bg-white/20"
                                    onClick={() => setIsOpen(false)}
                                >
                                    <X className="h-6 w-6" />
                                </Button>

                                {/* Navigation Buttons */}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 text-white hover:bg-black/70"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        showNext()
                                    }}
                                >
                                    <ChevronLeft className="h-8 w-8" />
                                </Button>

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 text-white hover:bg-black/70"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        showPrev()
                                    }}
                                >
                                    <ChevronRight className="h-8 w-8" />
                                </Button>

                                {/* Main Image */}
                                <img
                                    src={photos[currentPhotoIndex].src}
                                    alt={photos[currentPhotoIndex].alt}
                                    className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
                                />

                                {/* Caption */}
                                <div className="absolute bottom-4 left-0 right-0 text-center">
                                    <span className="rounded-full bg-black/50 px-4 py-2 text-sm text-white backdrop-blur-sm">
                                        {currentPhotoIndex + 1} / {photos.length}
                                    </span>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                ))}
            </div>
        </section>
    )
}
