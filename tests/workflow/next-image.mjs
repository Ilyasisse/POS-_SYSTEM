// Native ESM does not unwrap Next's CommonJS default export as tsx does.
import image from "next/dist/shared/lib/image-external.js";

export default image.default ?? image;
