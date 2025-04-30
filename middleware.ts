import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  // Get the pathname
  const path = request.nextUrl.pathname;

  // Log the request for debugging
  console.log(`Middleware processing: ${path}`);

  // Clone the request headers for potential modifications
  const requestHeaders = new Headers(request.headers);

  // Add x-url header to indicate the original URL
  requestHeaders.set("x-url", request.url);

  // For SAML callback, ensure we preserve the POST method and body
  if (path === "/api/saml/callback") {
    console.log("Processing SAML callback in middleware - passing through");

    // Make sure we don't interfere with the SAML POST request
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

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
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // Check if the user is authenticated
  const sessionCookie = request.cookies.get("auth-session"); // Use the iron-session cookie name

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
    // We can't directly decode the iron-session cookie as it's encrypted
    // But we can check if it exists and handle root path redirection

    // Root path handling - redirect based on the existence of a session
    if (path === "/") {
      console.log("Root path detected, redirecting to home page");
      // Get the base URL from request headers
      const host =
        request.headers.get("x-forwarded-host") ||
        request.headers.get("host") ||
        "askyourmd.nssfug.org";
      const proto = request.headers.get("x-forwarded-proto") || "https";
      const baseUrl = `${proto}://${host}`;

      // Since we can't determine the user type from the encrypted cookie,
      // redirect to a general home page that can then redirect based on session data
      return NextResponse.redirect(new URL("/home", baseUrl));
    }

    // Allow access to all other paths if a session cookie exists
    // The actual authorization will be handled by the page components
    console.log(`Session cookie found, allowing access to ${path}`);
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (error) {
    console.error(`Error in middleware:`, error);
    // Get the base URL from request headers
    const host =
      request.headers.get("x-forwarded-host") ||
      request.headers.get("host") ||
      "askyourmd.nssfug.org";
    const proto = request.headers.get("x-forwarded-proto") || "https";
    const baseUrl = `${proto}://${host}`;

    // Redirect to login page if there's an error
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
