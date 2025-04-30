import { NextResponse } from "next/server";
import { createSamlStrategy } from "@/lib/saml";
import { headers } from "next/headers";

// Helper function to get the base URL from request headers
const getBaseUrlFromRequest = async () => {
  const headersList = await headers();

  // Check for X-Forwarded-Host and X-Forwarded-Proto headers
  const host =
    headersList.get("x-forwarded-host") ||
    headersList.get("host") ||
    "askyourmd.nssfug.org";
  const proto = headersList.get("x-forwarded-proto") || "https";

  return `${proto}://${host}`;
};

export async function GET() {
  try {
    console.log("SAML login endpoint called");
    const strategy = createSamlStrategy();

    // Check if _saml exists
    if (!strategy || !strategy._saml) {
      console.error("SAML strategy not properly initialized");
      return NextResponse.json(
        { error: "SAML strategy not properly initialized" },
        { status: 500 }
      );
    }

    // Get the base URL from request headers
    const baseUrl = await getBaseUrlFromRequest();
    console.log("Base URL for SAML login:", baseUrl);

    // Create a custom request object that passport-saml can use
    const req = {
      query: {},
      body: {},
      url: "/api/saml/login",
      originalUrl: "/api/saml/login",
      headers: {
        host: new URL(baseUrl).host,
      },
      protocol: new URL(baseUrl).protocol.replace(":", ""),
    } as any;

    try {
      // Use getAuthorizeUrlAsync with all required arguments
      const relayState = ""; // Empty string or some state you want to maintain
      const host = new URL(baseUrl).host; // Your application's hostname
      const options = {}; // Additional options if needed

      console.log("Generating SAML authorize URL with host:", host);
      const url = await strategy._saml.getAuthorizeUrlAsync(
        relayState,
        host,
        options
      );

      console.log("Generated SAML authorize URL:", url);

      // Redirect to Azure AD login page
      return NextResponse.redirect(url);
    } catch (err) {
      console.error("Error generating SAML request:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      return NextResponse.redirect(
        `${baseUrl}/?error=saml_request_failed&details=${encodeURIComponent(
          errorMessage
        )}`
      );
    }
  } catch (error) {
    console.error("Error initiating SAML login:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    // Use a hardcoded URL as fallback
    return NextResponse.redirect(
      `https://askyourmd.nssfug.org/?error=saml_login_error&details=${encodeURIComponent(
        errorMessage
      )}`
    );
  }
}
