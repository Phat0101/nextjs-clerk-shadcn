import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/jobs(.*)",
  "/admin(.*)",
]);

const isInternalAPIRoute = createRouteMatcher([
  "/api/send-completion-email",
  "/api/postmark-webhook(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // Skip auth for internal API routes (called by Convex or external webhooks)
  if (isInternalAPIRoute(req)) return;
  
  if (isProtectedRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
