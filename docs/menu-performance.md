# Menu rendering and product images

The menu should show its header, hero, and navigation while database-backed products load. Product images should not compete with the hero on the first screen.

## Where to make changes

- `src/app/menu/page.tsx` composes the route. Its Suspense boundary contains only the database-backed menu.
- `src/app/menu/_components` contains route-only chrome, the static hero/footer, the product loading state, and the async data wrapper.
- `src/components/menu/MenuShowcase.tsx` owns category selection and load-more state. Category IDs identify tabs; slugs are display metadata and need not be unique.
- `src/lib/menu/menu-data.ts` loads categories/products and paid-order quantities, prepares category groups, and selects featured products.
- `src/lib/menu/menu-config.ts` holds the existing cafe name and local hero path.
- `src/types/menu/menu-types.ts` is the canonical menu contract. `MenuData.categories` always exists, including for an empty menu. The old product-types export remains compatible.
- `src/lib/products/product-images.ts` reads legacy signed URLs, public URLs, or bucket-relative paths and uses Supabase `getPublicUrl()`. It does not write to the database or make a Storage request.
- `src/lib/products/product-image-config.ts` holds the bucket, fallback path, and optimizer allowlist. It stays SDK-free because the shared image component imports its public fallback configuration.
- `src/components/products/ProductImage.tsx` is shared by menu and customer routes. It uses responsive Next.js images and attempts the fallback once before showing a stable unavailable-image state.
- Both product APIs return browser-ready public URLs in the existing `imageUrl` field. Admin thumbnails use the same conversion.

## Menu rules

Categories use database name ordering (A–Z), preserve their database IDs, and remain grouped throughout loading. Only active categories with active, currently available products are displayed.

Sales scores sum quantities from PAID orders across all history for eligible product IDs. They are gross ordered quantities, not refund-adjusted accounting figures. There is no arbitrary top-eight cutoff. Within each category, products sort by score descending, then manually marked popularity, then name ascending.

Featured items use up to four products from the strongest available signal: positive sales scores, otherwise popular products, otherwise all eligible products. A short stronger-signal list is not filled from the next group.

`getMenuData()` returns live data or an inline empty response. Database loading failures retain the existing logged-error and empty-menu behavior. No cross-request menu-data cache was added; availability stays request-time.

## Product image contract

Only this project's `IMG_Products` bucket is converted and allowed through Next.js remote image optimization. Other buckets and unexpected hosts are not proxied. Stored legacy URLs remain untouched.

The neutral fallback is `IMG_Products/placeholder/product-fallback.webp`. The hero remains the local `public/menu-hero-bg.webp` asset. Product/fallback configuration is independent of cafe branding.

Image management remains in the authorized Supabase dashboard workflow. Upload a new object and use its bucket-relative path in the existing product image field for future updates; existing signed/public URLs also remain readable. Use a new filename when replacing an image because browser, CDN, and Next.js optimized-image caches can retain old contents. This feature adds no upload/delete endpoints or write grants.

Only public Supabase configuration is used for URL generation. No service-role credentials enter browser bundles. No database/schema migration, object move, permission change, or cafeteria-domain integration is part of this branch.

## Rendering and performance

The hero is rendered before product data resolves and is prioritized as the LCP image. It uses a real responsive `sizes="100vw"` value. Menu content is visible without waiting for AOS or hydration.

Product and featured cards reserve their image frames and use native lazy loading. Only the selected category's visible products are mounted; other categories do not request images until selected. The shared customer grid and customization modal also use optimized responsive images. Page layouts and existing crop framing are preserved. A small menu-only favicon avoids fetching the full-size logo for the browser tab.

The lab comparison uses Lighthouse 13.6.0 with actual DevTools throttling: 390×844 viewport, DPR 2, 150 ms request latency, 1600 Kbps download, 750 Kbps upload, and 4× CPU slowdown. This fixed slowdown is reproducible; it is not a calibration of a particular physical mid-tier phone. Three cold-browser runs form the main comparison. Separate CPU-unthrottled and warm-browser-cache runs distinguish bottlenecks. Server-side image caches can remain warm between browser runs, as on a deployed application.

### Verified results — 2026-11-05

| Metric (median of three cold browser runs) |   Before |    Final |
| ------------------------------------------ | -------: | -------: |
| LCP                                        |   3.84 s |   1.49 s |
| FCP                                        |   2.91 s |   1.49 s |
| CLS                                        |        0 |        0 |
| Total transferred                          |  7.25 MB | 597.0 KB |
| Image transfer                             |  5.33 MB |  93.2 KB |
| Script transfer                            | 456.5 KB | 450.6 KB |
| Main-thread work                           |   7.63 s |   2.52 s |
| Total Blocking Time                        |   674 ms |   807 ms |
| Performance score                          |       72 |       80 |

LCP improved by 61.3% and meets the 2.5-second lab target. CLS meets the 0.1 target. The optimized menu also uses a 4.2 KB derived favicon instead of downloading the original 1.38 MB logo as its tab icon; this override applies only to /menu.

With CPU unthrottled but the same network shaping, LCP changed from 2.72 s to 0.97 s. With a warm browser cache at 4× CPU, LCP changed from 2.37 s to 0.66 s.

The approved alphabetical ordering changes the initially selected category. To separate that from image-format savings, all 44 original product/fallback images were also checked individually through the optimizer at 400px: 75.06 MB became 842.3 KB in aggregate, with every response decoding successfully. Anonymous public-image checks also passed 44/44. Stored signed URLs remain unchanged.

The existing global PostHog bundle remains a significant CPU cost. TBT did not improve in these runs, even though overall main-thread work decreased and the page became visible earlier. Earlier FCP changes the TBT measurement window. These results do not claim perfect interactivity or a 100-point throttled score; analytics behavior was deliberately preserved.

The unchanged production site was measured separately, with median LCP 36.72 s. It still serves an approximately 1.39 MB PNG hero. This hosted reference is not the causal before/after comparison because it uses a different deployment and origin. Its first 45-second attempt timed out and was excluded; the three complete reference runs used a 90-second load limit and skipped only the full-page screenshot capture. No deployment was performed.

The actual before/after comparison uses local Next.js production serving with the same environment, viewport and shaping. The baseline used compile mode to bypass the pre-existing type-only categories errors; the changed branch passed a normal full production build. Cold-browser runs do not reset server/CDN image caches.

Streaming checks show the hero in the first response chunk while product content is still loading. The initial HTML also contains a loading state; eager product CSS backgrounds are gone. The loading state retains the Explore Menu anchor until the real section replaces it.

39 focused unit/interaction/regression tests, TypeScript, scoped ESLint, and the full production build passed. React Doctor reported 92/100 with no changed-code issues. Both product APIs returned HTTP 200, public image URLs, and preserved modifier groups.

Detailed Lighthouse HTML reports, traces, HTTP audits and screenshots are retained as local Codex task artifacts rather than committed runtime output.

## Checks

Run the image/menu tests and the existing customer, availability, and routing regressions, then TypeScript, scoped ESLint, a normal production build, and React Doctor. Anonymous HTTP checks must cover every stored product image and the neutral fallback. Browser checks cover category selection, load more, mobile navigation, and customer images.

The development server is not used as the production-performance baseline.
