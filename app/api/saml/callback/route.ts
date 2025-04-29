import { type NextRequest, NextResponse } from "next/server";
import { parseSamlResponse } from "@/lib/saml";
import { getSession } from "@/lib/session";

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

    // Redirect to staff home page
    return NextResponse.redirect(new URL("/staff/home", req.url));
  } catch (error) {
    console.error("Error processing SAML callback:", error);
    return NextResponse.redirect(new URL("/login?error=saml_failed", req.url));
  }
}
