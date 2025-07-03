"use node";

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convexUrl = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error("Missing CONVEX_URL or NEXT_PUBLIC_CONVEX_URL environment variable (e.g. https://<deployment>.convex.cloud)");
}

/**
 * Singleton ConvexHttpClient for server-side usage.
 */
export const convex = new ConvexHttpClient(convexUrl);

export { api }; 