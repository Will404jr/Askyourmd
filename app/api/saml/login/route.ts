import { NextResponse } from "next/server";
import { createSamlStrategy } from "@/lib/saml";

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

    // Create a custom request object that passport-saml can use
    const req = {
      query: {},
      body: {},
      url: "https://askyourmd.nssfug.org/api/saml/login",
      originalUrl: "https://askyourmd.nssfug.org/api/saml/login",
      headers: {
        host: "askyourmd.nssfug.org",
      },
      method: "GET",
      protocol: "https",
    } as any;

    try {
      // Use getAuthorizeUrlAsync with all required arguments
      // 1. RelayState: A string that will be passed back to the callback
      // 2. host: The hostname of the server
      // 3. options: Additional options for the authorization request
      const relayState = ""; // Empty string or some state you want to maintain
      const host = "askyourmd.nssfug.org"; // Your application's hostname
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
