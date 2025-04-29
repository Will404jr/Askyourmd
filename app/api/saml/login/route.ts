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
    const strategy = createSamlStrategy();

    // Check if _saml exists
    if (!strategy._saml) {
      return NextResponse.json(
        { error: "SAML strategy not properly initialized" },
        { status: 500 }
      );
    }

    // Get the base URL from request headers
    const baseUrl = await getBaseUrlFromRequest();

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

      const url = await strategy._saml.getAuthorizeUrlAsync(
        relayState,
        host,
        options
      );

      // Redirect to Azure AD login page
      return NextResponse.redirect(url);
    } catch (err) {
      console.error("Error generating SAML request:", err);
      return NextResponse.json(
        { error: "Failed to generate SAML request" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error initiating SAML login:", error);
    return NextResponse.json(
      { error: "Failed to initiate SAML login" },
      { status: 500 }
    );
  }
}
