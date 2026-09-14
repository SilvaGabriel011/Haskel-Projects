import type { MetadataRoute } from "next";

/** The back office is not for the public. Nothing here should ever be indexed. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
