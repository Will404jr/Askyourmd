import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  // Get the pathname
  const path = request.nextUrl.pathname;

  // Log the request for debugging
  console.log(`Middleware processing: ${path}`);

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
    console.log(`Public path: ${path}, allowing access`);
    return NextResponse.next();
  }

  // Check if the user is authenticated
  const sessionCookie = request.cookies.get("session");

  if (!sessionCookie) {
    console.log(`No session cookie found, redirecting to login`);
    // Get the base URL from request headers
    const host =
      request.headers.get("x-forwarded-host") ||
      request.headers.get("host") ||
      "askyourmd.nssfug.org";
    const proto = request.headers.get("x-forwarded-proto") || "https";
    const baseUrl = `${proto}://${host}`;

    // Redirect to login page if no session cookie
    return NextResponse.redirect(new URL("/", baseUrl));
  }

  try {
    // Parse the session cookie
    const session = JSON.parse(atob(sessionCookie.value));
    console.log(`Session found for user: ${session.username}`);

    // Check if the session is expired
    if (session.expiresAt < Date.now()) {
      console.log(`Session expired, redirecting to login`);
      // Get the base URL from request headers
      const host =
        request.headers.get("x-forwarded-host") ||
        request.headers.get("host") ||
        "askyourmd.nssfug.org";
      const proto = request.headers.get("x-forwarded-proto") || "https";
      const baseUrl = `${proto}://${host}`;

      // Redirect to login page if session is expired
      return NextResponse.redirect(new URL("/", baseUrl));
    }

    // Check if the user is trying to access a protected route
    if (path.startsWith("/MD") && session.personnelType !== "Md") {
      console.log(
        `Staff user trying to access MD route, redirecting to staff home`
      );
      // Get the base URL from request headers
      const host =
        request.headers.get("x-forwarded-host") ||
        request.headers.get("host") ||
        "askyourmd.nssfug.org";
      const proto = request.headers.get("x-forwarded-proto") || "https";
      const baseUrl = `${proto}://${host}`;

      // Redirect to staff home if trying to access MD routes as staff
      return NextResponse.redirect(new URL("/staff/home", baseUrl));
    }

    if (path.startsWith("/staff") && session.personnelType !== "Staff") {
      console.log(
        `MD user trying to access staff route, redirecting to MD home`
      );
      // Get the base URL from request headers
      const host =
        request.headers.get("x-forwarded-host") ||
        request.headers.get("host") ||
        "askyourmd.nssfug.org";
      const proto = request.headers.get("x-forwarded-proto") || "https";
      const baseUrl = `${proto}://${host}`;

      // Redirect to MD home if trying to access staff routes as MD
      return NextResponse.redirect(new URL("/MD/home", baseUrl));
    }

    // Allow access
    console.log(`Access granted to ${path}`);
    return NextResponse.next();
  } catch (error) {
    console.error(`Error processing session:`, error);
    // Get the base URL from request headers
    const host =
      request.headers.get("x-forwarded-host") ||
      request.headers.get("host") ||
      "askyourmd.nssfug.org";
    const proto = request.headers.get("x-forwarded-proto") || "https";
    const baseUrl = `${proto}://${host}`;

    // Redirect to login page if session is invalid
    return NextResponse.redirect(new URL("/", baseUrl));
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
