import { type NextRequest, NextResponse } from "next/server";
import { getSamlLoginUrl } from "@/lib/saml";

// Initiate SAML authentication
export async function GET(req: NextRequest) {
  try {
    const returnTo =
      new URL(req.url).searchParams.get("returnTo") || "/staff/home";

    // Generate SAML authentication request URL
    const loginUrl = getSamlLoginUrl(returnTo);

    console.log("Redirecting to SAML login URL:", loginUrl);

    // Redirect to IdP login page
    return NextResponse.redirect(loginUrl);
  } catch (error) {
    console.error("SAML authentication error:", error);
    return NextResponse.json(
      { error: "Failed to initiate SAML authentication" },
      { status: 500 }
    );
  }
}
