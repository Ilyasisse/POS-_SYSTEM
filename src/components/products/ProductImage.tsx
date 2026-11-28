"use client";
import Image from "next/image";
import { useState } from "react";
import { PRODUCT_FALLBACK_IMAGE_URL } from "@/lib/products/product-image-config";
type ProductImageProps = {
  src: string | null | undefined;
  alt: string;
  sizes: string;
  className?: string;
};
/** Requires a positioned parent with dimensions for Image's fill. */
export default function ProductImage(props: ProductImageProps) {
  const source = props.src?.trim() || PRODUCT_FALLBACK_IMAGE_URL;
  // Reset failure state when the product image URL changes.
  return <ImageWithFallback key={source} {...props} source={source} />;
}
function ImageWithFallback({
  source,
  alt,
  sizes,
  className,
}: Omit<ProductImageProps, "src"> & { source: string }) {
  const [sourceState, setSourceState] = useState<"original" | "fallback" | "unavailable">(
    "original",
  );
  const currentSource = sourceState === "original" ? source : PRODUCT_FALLBACK_IMAGE_URL;
  if (!currentSource || sourceState === "unavailable")
    return (
      <span
        role="img"
        aria-label={alt + " — image not available"}
        className="absolute inset-0 flex items-center justify-center bg-neutral-100 p-4 text-center text-sm text-neutral-500"
      >
        Image Not Available
      </span>
    );
  const isFallback = currentSource === PRODUCT_FALLBACK_IMAGE_URL;
  return (
    <Image
      src={currentSource}
      alt={alt}
      fill
      sizes={sizes}
      loading="lazy"
      className={className ?? "object-cover"}
      style={isFallback ? { objectFit: "contain", backgroundColor: "#fafafa" } : undefined}
      // Stop retrying if the fallback itself fails.
      onError={() => setSourceState(isFallback ? "unavailable" : "fallback")}
    />
  );
}
