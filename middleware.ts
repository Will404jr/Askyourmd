import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession } from "./lib/session";

// Paths that don't require authentication
const publicPaths = ["/", "/login"];

export async function middleware(request: NextRequest) {
  const session = await getSession();
  const { pathname } = request.nextUrl;

  // Check if the path is public
  const isPublicPath = publicPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  // If not logged in and trying to access a protected route, redirect to login
  if (!session.isLoggedIn && !isPublicPath) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // If logged in and trying to access login page, redirect based on personnelType
  if (session.isLoggedIn && isPublicPath) {
    // Determine redirect URL based on personnelType
    let redirectUrl = "/staff/home"; // Default redirect

    if (session.personnelType === "Md") {
      redirectUrl = "/MD/home";
    } else if (session.personnelType === "Staff") {
      redirectUrl = "/staff/home";
    }

    return NextResponse.redirect(new URL(redirectUrl, request.url));
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
