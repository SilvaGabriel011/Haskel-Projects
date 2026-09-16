import type { MetadataRoute } from "next";

/** The back office is not for the public. Nothing here should ever be indexed. */
export default function robots(): MetadataRoute.Robots {
  return {
    // The booking page is the one thing here meant to be found. Everything
    // else stays out of search.
    rules: [{ userAgent: "*", allow: ["/book"], disallow: "/" }],
  };
}
