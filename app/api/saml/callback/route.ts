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
    console.log("SAML callback received");

    // Log headers for debugging
    const headersList = await headers();
    console.log("Headers:", Object.fromEntries(headersList.entries()));

    const formData = await req.formData();
    const samlResponse = formData.get("SAMLResponse");

    console.log("SAML Response received:", !!samlResponse);

    if (!samlResponse) {
      console.error("No SAML response provided");
      return NextResponse.redirect(
        new URL("/login?error=no_saml_response", await getBaseUrlFromRequest())
      );
    }

    try {
      // Convert FormDataEntryValue to string
      const samlResponseString = samlResponse.toString();
      console.log("SAML Response length:", samlResponseString.length);

      // Parse SAML response
      const profile = await parseSamlResponse(samlResponseString);
      console.log("SAML Profile:", JSON.stringify(profile, null, 2));

      if (!profile) {
        console.error("No profile returned from SAML response");
        return NextResponse.redirect(
          new URL("/login?error=no_profile", await getBaseUrlFromRequest())
        );
      }

      // Create user object from SAML profile
      const user = {
        id:
          profile.id ||
          profile.nameID ||
          profile[
            "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
          ] ||
          "unknown-id",
        username:
          profile.username ||
          profile[
            "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname"
          ] ||
          profile.givenName ||
          "unknown-user",
        email:
          profile.email ||
          profile[
            "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
          ] ||
          profile.mail ||
          "unknown-email",
        personnelType: "Staff",
      };

      console.log("User object created:", user);

      // Set session
      try {
        const session = await getSession();
        session.id = user.id;
        session.isLoggedIn = true;
        session.username = user.username;
        session.email = user.email;
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

        await session.save();
        console.log("Session saved successfully");

        // Verify the session was saved by retrieving it again
        const verifySession = await getSession();
        console.log("Session after save verification:", {
          id: verifySession.id,
          username: verifySession.username,
          isLoggedIn: verifySession.isLoggedIn,
        });
      } catch (sessionError) {
        console.error("Error saving session:", sessionError);
        return NextResponse.redirect(
          new URL(
            "/login?error=session_save_failed",
            await getBaseUrlFromRequest()
          )
        );
      }

      // Get the base URL from request headers
      const baseUrl = await getBaseUrlFromRequest();
      const redirectUrl = new URL("/staff/home", baseUrl);

      console.log("Redirecting to:", redirectUrl.toString());

      // Create a response with the redirect
      const response = NextResponse.redirect(redirectUrl, { status: 302 });

      // Log the response headers for debugging
      console.log(
        "Response headers:",
        Object.fromEntries(response.headers.entries())
      );

      return response;
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
