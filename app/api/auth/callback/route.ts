import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

// Azure AD configuration
const AZURE_AD_TENANT_ID =
  process.env.AZURE_AD_TENANT_ID || "708f7b5b-20fc-4bc8-9150-b1015a308b9c";
const AZURE_AD_CLIENT_ID = process.env.AZURE_AD_CLIENT_ID;
const AZURE_AD_CLIENT_SECRET = process.env.AZURE_AD_CLIENT_SECRET;

// Whitelist of email addresses that should have admin privileges
const ADMIN_EMAILS = ["payota@nssfug.org", "mathieno@nssfug.org"];

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
    console.log("Request headers:", Object.fromEntries(req.headers.entries()));
    console.log("Request cookies:", req.cookies.getAll());

    // Get form data from the request
    const formData = await req.formData();
    const code = formData.get("code") as string;
    const state = formData.get("state") as string;
    const error = formData.get("error") as string;
    const errorDescription = formData.get("error_description") as string;

    console.log("Form data received:", {
      code: code ? "present" : "missing",
      state,
      error,
      errorDescription,
    });

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

    // Get the state cookie
    const stateCookie = req.cookies.get("auth_state")?.value;
    console.log("State comparison:", {
      receivedState: state,
      cookieState: stateCookie,
      match: state === stateCookie,
    });

    // Skip state validation for now to debug the flow
    // if (!state || state !== stateCookie) {
    //   console.error("Invalid state parameter")
    //   const baseUrl = getBaseUrlFromRequest(req)
    //   return NextResponse.redirect(`${baseUrl}/?error=invalid_state`)
    // }

    // Exchange code for tokens
    const baseUrl = getBaseUrlFromRequest(req);
    const redirectUri = `${baseUrl}/api/auth/callback`;

    console.log("Exchanging code for token with redirect URI:", redirectUri);
    const tokenResponse = await getTokenFromCode(code, redirectUri);

    if (!tokenResponse || tokenResponse.error) {
      console.error(
        "Token exchange failed:",
        tokenResponse?.error_description || "Unknown error"
      );
      return NextResponse.redirect(
        `${baseUrl}/?error=token_exchange_failed&details=${encodeURIComponent(
          JSON.stringify(tokenResponse)
        )}`
      );
    }

    // Get user info from ID token
    const userData = parseIdToken(tokenResponse.id_token);

    if (!userData) {
      console.error("Failed to parse ID token");
      return NextResponse.redirect(`${baseUrl}/?error=invalid_id_token`);
    }

    console.log("User authenticated:", userData.name);

    // Get user email
    const userEmail = userData.email || userData.preferred_username || "";
    console.log("User email:", userEmail);

    // Check if the user is in the admin whitelist
    const isWhitelistedAdmin = ADMIN_EMAILS.includes(userEmail.toLowerCase());
    console.log("Is whitelisted admin:", isWhitelistedAdmin);

    // Create session
    const session = await getSession();

    // Set session data
    if (isWhitelistedAdmin) {
      // Use exact admin session values for whitelisted users
      session.id = "admin";
      session.isLoggedIn = true;
      session.username = "Admin";
      session.email = "admin@nssfug.org";
      session.personnelType = "Md";
      session.expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

      console.log("Whitelisted user detected. Setting admin session values.");
    } else {
      // Regular staff user
      session.id = userData.oid || userData.sub;
      session.isLoggedIn = true;
      session.username = userData.given_name || userData.name;
      session.email = userEmail;
      session.givenName = userData.given_name || "";
      session.surname = userData.family_name || "";
      session.userPrincipalName = userData.preferred_username || userData.email;
      session.personnelType = "Staff";
      session.expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    }

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
    const redirectPath = isWhitelistedAdmin ? "/MD/home" : "/staff/home";
    const response = NextResponse.redirect(`${baseUrl}${redirectPath}`);
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
    console.log("Token request params:", params.toString());

    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await response.json();
    console.log("Token response status:", response.status);
    console.log("Token response:", {
      success: response.ok,
      error: data.error,
      error_description: data.error_description,
      token_type: data.token_type,
      scope: data.scope,
      expires_in: data.expires_in,
      has_id_token: !!data.id_token,
    });

    return data;
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
