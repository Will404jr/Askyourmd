import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

// Helper function to get the base URL from request headers
const getBaseUrlFromRequest = (req: NextRequest) => {
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "askyourmd.nssfug.org";
  const proto = req.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
};

export async function GET(req: NextRequest) {
  try {
    console.log("SAML callback received");
    console.log("Request headers:", Object.fromEntries(req.headers.entries()));

    // Get the state parameter from the query string
    const { searchParams } = new URL(req.url);
    const state = searchParams.get("state");

    if (!state) {
      console.error("No state parameter found in request");
      return NextResponse.redirect(
        new URL("/?error=no_state_parameter", req.url)
      );
    }

    // Verify the authentication with the microservice
    const authServiceUrl =
      process.env.AUTH_SERVICE_URL || "http://localhost:4000";
    const verifyUrl = `${authServiceUrl}/verify?state=${state}`;

    console.log(`Verifying authentication with: ${verifyUrl}`);

    try {
      const response = await fetch(verifyUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Authentication verification failed:", errorData);
        return NextResponse.redirect(
          new URL("/?error=auth_verification_failed", req.url)
        );
      }

      const data = await response.json();

      if (!data.success || !data.user) {
        console.error("Invalid response from auth service:", data);
        return NextResponse.redirect(
          new URL("/?error=invalid_auth_response", req.url)
        );
      }

      const userData = data.user;

      console.log("User data received:", userData);

      // Get the session
      const session = await getSession();

      // Set session data
      session.id = userData.id;
      session.isLoggedIn = true;
      session.username = userData.givenName || userData.displayName;
      session.email = userData.email;
      session.givenName = userData.givenName;
      session.surname = userData.surname;
      session.userPrincipalName = userData.email;
      session.personnelType = userData.personnelType;
      session.expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

      console.log("Session before save:", {
        id: session.id,
        username: session.username,
        email: session.email,
        personnelType: session.personnelType,
        isLoggedIn: session.isLoggedIn,
        expiresAt: session.expiresAt,
      });

      try {
        await session.save();
        console.log("Session saved successfully");
      } catch (saveError) {
        console.error("Error saving session:", saveError);
        return NextResponse.redirect(
          new URL("/?error=session_save_failed", req.url)
        );
      }

      // Get the base URL for redirection
      const baseUrl = getBaseUrlFromRequest(req);
      console.log("Redirecting to Staff home with base URL:", baseUrl);

      // Redirect to the staff home page
      return NextResponse.redirect(new URL("/Staff/home", baseUrl));
    } catch (fetchError) {
      console.error("Error verifying authentication:", fetchError);
      return NextResponse.redirect(
        new URL("/?error=auth_verification_error", req.url)
      );
    }
  } catch (error) {
    console.error("Error processing SAML callback:", error);
    // Use a hardcoded production URL as fallback if everything else fails
    const fallbackUrl = "https://askyourmd.nssfug.org";
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.redirect(
      `${fallbackUrl}/?error=saml_callback_error&details=${encodeURIComponent(
        errorMessage
      )}`
    );
  }
}

// Also handle POST requests for backward compatibility
export async function POST(req: NextRequest) {
  console.log(
    "POST request received at SAML callback - redirecting to GET handler"
  );
  return GET(req);
}
