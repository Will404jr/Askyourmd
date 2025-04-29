import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  // Get the pathname
  const path = request.nextUrl.pathname;

  // Public paths that don't require authentication
  const publicPaths = [
    "/",
    "/api/login",
    "/api/saml/login",
    "/api/saml/callback",
    "/api/saml/metadata",
    "/api/saml/logout",
  ];

  // Check if the path is public
  const isPublicPath = publicPaths.some(
    (publicPath) => path === publicPath || path.startsWith(publicPath + "/")
  );

  // If the path is public, allow access
  if (isPublicPath) {
    return NextResponse.next();
  }

  // Check if the user is authenticated
  const sessionCookie = request.cookies.get("session");

  if (!sessionCookie) {
    // Redirect to login page if no session cookie
    return NextResponse.redirect(new URL("/", request.url));
  }

  try {
    // Parse the session cookie
    const session = JSON.parse(atob(sessionCookie.value));

    // Check if the session is expired
    if (session.expiresAt < Date.now()) {
      // Redirect to login page if session is expired
      return NextResponse.redirect(new URL("/", request.url));
    }

    // Check if the user is trying to access a protected route
    if (path.startsWith("/MD") && session.personnelType !== "Md") {
      // Redirect to staff home if trying to access MD routes as staff
      return NextResponse.redirect(new URL("/staff/home", request.url));
    }

    if (path.startsWith("/staff") && session.personnelType !== "Staff") {
      // Redirect to MD home if trying to access staff routes as MD
      return NextResponse.redirect(new URL("/MD/home", request.url));
    }

    // Allow access
    return NextResponse.next();
  } catch (error) {
    // Redirect to login page if session is invalid
    return NextResponse.redirect(new URL("/", request.url));
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|imgs|certs).*)",
  ],
};
