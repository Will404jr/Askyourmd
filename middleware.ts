import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession } from "./lib/session";

// Paths that don't require authentication
const publicPaths = [
  "/",
  "/api/login",
  "/api/users",
  "/api/auth/login",
  "/api/auth/callback",
  "/api/auth/stateless-login",
  "/api/saml/login",
  "/api/saml/callback",
  "/api/saml/metadata",
  "/api/saml/logout",
  "/api/check-certificate",
];

// The public-facing URL of your application
const BASE_URL = "https://askyourmd.nssfug.org";

export async function middleware(request: NextRequest) {
  const session = await getSession();
  const { pathname } = request.nextUrl;

  // Check if the path is public
  const isPublicPath = publicPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  // If not logged in and trying to access a protected route, redirect to login
  if (!session.isLoggedIn && !isPublicPath) {
    return NextResponse.redirect(new URL("/", BASE_URL));
  }

  // If logged in and trying to access login page, redirect based on personnelType
  if (session.isLoggedIn && isPublicPath) {
    // Determine where to redirect based on user type
    if (session.personnelType === "MD") {
      return NextResponse.redirect(new URL("/MD/home", BASE_URL));
    } else if (session.personnelType === "Staff") {
      return NextResponse.redirect(new URL("/staff/home", BASE_URL));
    } else {
      // Fallback for any other user type
      return NextResponse.redirect(new URL("/dashboard", BASE_URL));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes (we'll handle auth in the API routes themselves)
     */
    "/((?!_next/static|_next/image|favicon.ico|imgs|api).*)",
  ],
};
