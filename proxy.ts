import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Clerk proxy (compat-safe)
 *
 * Fixes:
 * - "Clerk: auth() was called but Clerk can't detect usage of clerkMiddleware()."
 *
 * Notes:
 * - Some @clerk/nextjs versions do NOT support auth().protect() inside proxy callback.
 * - This proxy enables Clerk context for auth() usage without forcing route protection.
 * - If you want to protect /app later, we can add version-specific protection logic.
 */
export default clerkMiddleware();

export const config = {
  matcher: [
    // Match all routes except Next.js internals and static files
    "/((?!_next|.*\\..*).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
