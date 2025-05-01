import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

// Azure AD configuration
const AZURE_AD_TENANT_ID =
  process.env.AZURE_AD_TENANT_ID || "708f7b5b-20fc-4bc8-9150-b1015a308b9c";
const AZURE_AD_CLIENT_ID = process.env.AZURE_AD_CLIENT_ID;
const AZURE_AD_CLIENT_SECRET = process.env.AZURE_AD_CLIENT_SECRET;

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
    console.log("Auth callback received");

    // Get form data from the request
    const formData = await req.formData();
    const code = formData.get("code") as string;
    const state = formData.get("state") as string;
    const error = formData.get("error") as string;
    const errorDescription = formData.get("error_description") as string;

    // Check for errors from Azure AD
    if (error) {
      console.error(`Azure AD error: ${error} - ${errorDescription}`);
      const baseUrl = getBaseUrlFromRequest(req);
      return NextResponse.redirect(
        `${baseUrl}/?error=azure_ad_error&details=${encodeURIComponent(
          errorDescription || error
        )}`
      );
    }

    // Verify state parameter against cookie
    const stateCookie = req.cookies.get("auth_state")?.value;
    if (!state || state !== stateCookie) {
      console.error("Invalid state parameter");
      const baseUrl = getBaseUrlFromRequest(req);
      return NextResponse.redirect(`${baseUrl}/?error=invalid_state`);
    }

    // Exchange code for tokens
    const baseUrl = getBaseUrlFromRequest(req);
    const redirectUri = `${baseUrl}/api/auth/callback`;
    const tokenResponse = await getTokenFromCode(code, redirectUri);

    if (!tokenResponse || tokenResponse.error) {
      console.error(
        "Token exchange failed:",
        tokenResponse?.error_description || "Unknown error"
      );
      return NextResponse.redirect(`${baseUrl}/?error=token_exchange_failed`);
    }

    // Get user info from ID token
    const userData = parseIdToken(tokenResponse.id_token);

    if (!userData) {
      console.error("Failed to parse ID token");
      return NextResponse.redirect(`${baseUrl}/?error=invalid_id_token`);
    }

    console.log("User authenticated:", userData.name);

    // Create session
    const session = await getSession();

    // Set session data
    session.id = userData.oid || userData.sub;
    session.isLoggedIn = true;
    session.username = userData.given_name || userData.name;
    session.email = userData.email || userData.preferred_username;
    session.givenName = userData.given_name || "";
    session.surname = userData.family_name || "";
    session.userPrincipalName = userData.preferred_username || userData.email;
    session.personnelType = "Staff";
    session.expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    console.log("Session before save:", {
      id: session.id,
      username: session.username,
      email: session.email,
      personnelType: session.personnelType,
      isLoggedIn: session.isLoggedIn,
    });

    try {
      await session.save();
      console.log("Session saved successfully");
    } catch (saveError) {
      console.error("Error saving session:", saveError);
      return NextResponse.redirect(`${baseUrl}/?error=session_save_failed`);
    }

    // Clear auth cookies
    const response = NextResponse.redirect(`${baseUrl}/Staff/home`);
    response.cookies.delete("auth_nonce");
    response.cookies.delete("auth_state");

    return response;
  } catch (error) {
    console.error("Error processing auth callback:", error);
    const baseUrl = getBaseUrlFromRequest(req);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.redirect(
      `${baseUrl}/?error=auth_callback_error&details=${encodeURIComponent(
        errorMessage
      )}`
    );
  }
}

// Exchange authorization code for tokens
async function getTokenFromCode(code: string, redirectUri: string) {
  const tokenEndpoint = `https://login.microsoftonline.com/${AZURE_AD_TENANT_ID}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    client_id: AZURE_AD_CLIENT_ID!,
    client_secret: AZURE_AD_CLIENT_SECRET!,
    code: code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  try {
    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    return await response.json();
  } catch (error) {
    console.error("Error exchanging code for token:", error);
    return null;
  }
}

// Parse the ID token to get user information
function parseIdToken(idToken: string) {
  try {
    // ID token is a JWT - split by dots and decode the payload (second part)
    const parts = idToken.split(".");
    if (parts.length !== 3) {
      console.error("Invalid ID token format");
      return null;
    }

    // Base64 decode and parse as JSON
    const payload = Buffer.from(parts[1], "base64").toString();
    return JSON.parse(payload);
  } catch (error) {
    console.error("Error parsing ID token:", error);
    return null;
  }
}

// Handle GET requests for backward compatibility
export async function GET(req: NextRequest) {
  console.log("GET request received at auth callback - not supported");
  const baseUrl = getBaseUrlFromRequest(req);
  return NextResponse.redirect(`${baseUrl}/?error=invalid_auth_flow`);
}
