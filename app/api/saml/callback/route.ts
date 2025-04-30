import { type NextRequest, NextResponse } from "next/server";
import { parseSamlResponse } from "@/lib/saml";
import { getSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    console.log("SAML callback received");

    // Get form data from the request
    const formData = await req.formData();
    const samlResponse = formData.get("SAMLResponse") as string;
    const relayState = (formData.get("RelayState") as string) || "";

    if (!samlResponse) {
      console.error("No SAML response found in request");
      return NextResponse.redirect(new URL("/?error=saml_failed", req.url));
    }

    console.log("Parsing SAML response");

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
      return NextResponse.redirect(
        new URL("/?error=session_save_failed", req.url)
      );
    }

    // Get the base URL from request headers for redirection
    const host =
      req.headers.get("x-forwarded-host") ||
      req.headers.get("host") ||
      "askyourmd.nssfug.org";
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const baseUrl = `${proto}://${host}`;

    // Redirect to the staff home page
    return NextResponse.redirect(new URL("/Staff/home", baseUrl));
  } catch (error) {
    console.error("Error processing SAML callback:", error);
    return NextResponse.redirect(new URL("/?error=saml_failed", req.url));
  }
}

// Also handle GET requests for cases where the IdP might redirect with a GET
export async function GET(req: NextRequest) {
  console.log(
    "GET request received at SAML callback - redirecting to login page"
  );
  return NextResponse.redirect(new URL("/?error=invalid_saml_flow", req.url));
}
