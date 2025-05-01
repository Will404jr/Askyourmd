import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession } from "./lib/session";

// Paths that don't require authentication
const publicPaths = [
  "https://askyourmd.nssfug.org/",
  "https://askyourmd.nssfug.org/api/login",
  "https://askyourmd.nssfug.org/api/auth/login",
  "https://askyourmd.nssfug.org/api/auth/callback",
  "https://askyourmd.nssfug.org/api/auth/stateless-login",
  "https://askyourmd.nssfug.org/api/saml/login",
  "https://askyourmd.nssfug.org/api/saml/callback",
  "https://askyourmd.nssfug.org/api/saml/metadata",
  "https://askyourmd.nssfug.org/api/saml/logout",
  "https://askyourmd.nssfug.org/api/check-certificate",
];

export async function middleware(request: NextRequest) {
  const session = await getSession();
  const { pathname } = request.nextUrl;

  // Check if the path is public
  const isPublicPath = publicPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  // If not logged in and trying to access a protected route, redirect to login
  if (!session.isLoggedIn && !isPublicPath) {
    return NextResponse.redirect(
      new URL("https://askyourmd.nssfug.org/", request.url)
    );
  }

  // If logged in and trying to access login page, redirect based on personnelType
  if (session.isLoggedIn && isPublicPath) {
    // Determine where to redirect based on user type
    if (session.personnelType === "MD") {
      return NextResponse.redirect(
        new URL("https://askyourmd.nssfug.org/MD/home", request.url)
      );
    } else if (session.personnelType === "Staff") {
      return NextResponse.redirect(
        new URL("https://askyourmd.nssfug.org/staff/home", request.url)
      );
    } else {
      // Fallback for any other user type
      return NextResponse.redirect(
        new URL("https://askyourmd.nssfug.org/dashboard", request.url)
      );
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
