"use client"

import Image from "next/image"
import { useState } from "react"
import type { ReactNode } from "react"

interface MediaImageProps {
    src?: string | null
    alt: string
    fill?: boolean
    width?: number
    height?: number
    sizes?: string
    quality?: number
    priority?: boolean
    className?: string
    fallback: ReactNode
    ariaHidden?: boolean
}

export function MediaImage({
    src,
    alt,
    fill = false,
    width,
    height,
    sizes,
    quality,
    priority,
    className,
    fallback,
    ariaHidden,
}: MediaImageProps) {
    const [hasError, setHasError] = useState(false)

    if (!src || hasError) {
        return <>{fallback}</>
    }

    return (
        <Image
            src={src}
            alt={alt}
            fill={fill}
            width={width}
            height={height}
            sizes={sizes}
            quality={quality}
            priority={priority}
            className={className}
            aria-hidden={ariaHidden}
            onError={() => setHasError(true)}
        />
    )
}
