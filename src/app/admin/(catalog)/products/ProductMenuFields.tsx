"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  PRODUCT_DESCRIPTION_MAX_LENGTH,
  PRODUCT_IMAGE_URL_MAX_LENGTH,
  productImageUrlError,
} from "@/lib/products/product-content";

export function ProductMenuFields({
  description,
  imageUrl,
}: {
  description?: string | null;
  imageUrl?: string | null;
}) {
  return (
    <>
      <div>
        <label htmlFor="product-description" className="mb-1 block text-sm font-medium">
          Menu description
        </label>
        <Textarea
          id="product-description"
          name="description"
          maxLength={PRODUCT_DESCRIPTION_MAX_LENGTH}
          defaultValue={description ?? ""}
        />
      </div>

      <div>
        <label htmlFor="product-image-url" className="mb-1 block text-sm font-medium">
          Image URL
        </label>
        <Input
          id="product-image-url"
          name="imageUrl"
          type="text"
          maxLength={PRODUCT_IMAGE_URL_MAX_LENGTH}
          defaultValue={imageUrl ?? ""}
          placeholder="https://example.com/photo.jpg"
          aria-describedby="product-image-url-hint"
          onChange={({ currentTarget }) =>
            currentTarget.setCustomValidity(
              currentTarget.value === imageUrl
                ? ""
                : (productImageUrlError(currentTarget.value) ?? ""),
            )
          }
        />
        <p id="product-image-url-hint" className="text-muted-foreground mt-1 text-xs">
          Paste an image URL or enter a site path such as /images/photo.jpg.
        </p>
      </div>
    </>
  );
}
