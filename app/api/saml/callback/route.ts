import { type NextRequest, NextResponse } from "next/server";
import { parseSamlResponse } from "@/lib/saml";
import { getSession } from "@/lib/session";
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

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const samlResponse = formData.get("SAMLResponse") as string;

    if (!samlResponse) {
      return NextResponse.json(
        { error: "No SAML response provided" },
        { status: 400 }
      );
    }

    try {
      // Parse SAML response
      const profile = await parseSamlResponse(samlResponse);

      // Create user object from SAML profile
      const user = {
        id:
          profile.id ||
          profile.nameID ||
          profile[
            "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
          ],
        username:
          profile.username ||
          profile[
            "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname"
          ] ||
          "",
        email:
          profile.email ||
          profile[
            "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
          ] ||
          profile.mail ||
          "",
        personnelType: "Staff",
      };

      // Set session
      const session = await getSession();
      session.id = user.id;
      session.isLoggedIn = true;
      session.username = user.username;
      session.email = user.email;
      session.personnelType = "Staff";
      session.expiresAt = Date.now() + 24 * 60 * 60 * 1000;
      await session.save();

      // Get the base URL from request headers
      const baseUrl = await getBaseUrlFromRequest();

      // Redirect to staff home page
      return NextResponse.redirect(new URL("/staff/home", baseUrl));
    } catch (error) {
      console.error("Error processing SAML response:", error);

      // Get the base URL from request headers
      const baseUrl = await getBaseUrlFromRequest();

      return NextResponse.redirect(
        new URL("/login?error=saml_failed", baseUrl)
      );
    }
  } catch (error) {
    console.error("Error processing form data:", error);

    // Get the base URL from request headers
    const baseUrl = await getBaseUrlFromRequest();

    return NextResponse.redirect(
      new URL("/login?error=form_data_failed", baseUrl)
    );
  }
}
