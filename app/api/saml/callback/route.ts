import { type NextRequest, NextResponse } from "next/server";
import { parseSamlResponse } from "@/lib/saml";
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

export async function POST(req: NextRequest) {
  try {
    console.log("SAML callback received");
    console.log("Request headers:", Object.fromEntries(req.headers.entries()));

    // Get form data from the request
    const formData = await req.formData();
    const samlResponse = formData.get("SAMLResponse") as string;
    const relayState = (formData.get("RelayState") as string) || "";

    if (!samlResponse) {
      console.error("No SAML response found in request");
      const baseUrl = getBaseUrlFromRequest(req);
      return NextResponse.redirect(`${baseUrl}/?error=no_saml_response`);
    }

    console.log("SAML response received, length:", samlResponse.length);

    try {
      // Parse the SAML response
      const profile = await parseSamlResponse(samlResponse);

      console.log("SAML profile received:", {
        nameID: profile.nameID,
        email:
          profile[
            "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
          ] || profile.mail,
        givenName:
          profile[
            "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname"
          ],
        surname:
          profile[
            "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname"
          ],
      });

      // Get the session
      const session = await getSession();

      // Set session data
      session.id =
        profile.nameID ||
        profile[
          "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
        ];
      session.isLoggedIn = true;
      session.username =
        profile[
          "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname"
        ] || "";
      session.email =
        profile[
          "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
        ] ||
        profile.mail ||
        "";
      session.givenName =
        profile[
          "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname"
        ] || "";
      session.surname =
        profile[
          "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname"
        ] || "";
      session.userPrincipalName =
        profile.userPrincipalName || profile.nameID || "";
      session.personnelType = "Staff";
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
        const baseUrl = getBaseUrlFromRequest(req);
        return NextResponse.redirect(`${baseUrl}/?error=session_save_failed`);
      }

      // Get the base URL for redirection
      const baseUrl = getBaseUrlFromRequest(req);
      console.log("Redirecting to Staff home with base URL:", baseUrl);

      // Redirect to the staff home page
      return NextResponse.redirect(`${baseUrl}/Staff/home`);
    } catch (parseError) {
      console.error("SAML parsing error:", parseError);
      const baseUrl = getBaseUrlFromRequest(req);
      return NextResponse.redirect(
        `${baseUrl}/?error=saml_parse_failed&details=${encodeURIComponent(
          (parseError as Error).message
        )}`
      );
    }
  } catch (error) {
    console.error("Error processing SAML callback:", error);
    // Use a hardcoded production URL as fallback if everything else fails
    const fallbackUrl = "https://askyourmd.nssfug.org";
    return NextResponse.redirect(
      `${fallbackUrl}/?error=saml_callback_error&details=${encodeURIComponent(
        (error as Error).message
      )}`
    );
  }
}

// Also handle GET requests for cases where the IdP might redirect with a GET
export async function GET(req: NextRequest) {
  console.log("GET request received at SAML callback");
  console.log("Request headers:", Object.fromEntries(req.headers.entries()));

  const baseUrl = getBaseUrlFromRequest(req);
  return NextResponse.redirect(`${baseUrl}/?error=invalid_saml_flow`);
}
