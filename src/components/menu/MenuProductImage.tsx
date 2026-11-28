"use client";

import Image from "next/image";
import { shouldOptimizeMenuImage } from "@/lib/menu/image-optimization";

export default function MenuProductImage({
  src,
  alt,
  sizes,
}: {
  src: string;
  alt: string;
  sizes: string;
}) {
  return (
    <Image
      key={src}
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      loading="lazy"
      decoding="async"
      fetchPriority="low"
      unoptimized={!shouldOptimizeMenuImage(src)}
      className="object-cover object-center"
      onError={(event) => {
        // Leave the existing card gradient visible if a stored image is missing.
        event.currentTarget.style.visibility = "hidden";
      }}
    />
  );
}
