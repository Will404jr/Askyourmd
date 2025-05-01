import { type NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

// Azure AD configuration
const AZURE_AD_TENANT_ID =
  process.env.AZURE_AD_TENANT_ID || "708f7b5b-20fc-4bc8-9150-b1015a308b9c";
const AZURE_AD_CLIENT_ID = process.env.AZURE_AD_CLIENT_ID;
const AZURE_AD_CLIENT_SECRET = process.env.AZURE_AD_CLIENT_SECRET;

// Get the base URL from request headers
const getBaseUrlFromRequest = (req: NextRequest) => {
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "askyourmd.nssfug.org";
  const proto = req.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
};

export async function GET(req: NextRequest) {
  try {
    console.log("Azure AD login initiated");

    // Generate a nonce and state for OIDC flow
    const nonce = uuidv4();
    const state = uuidv4();

    // Store these in cookies for validation in the callback
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 60 * 10, // 10 minutes
    };

    const response = NextResponse.redirect(
      buildAuthorizationUrl(req, nonce, state)
    );

    // Set cookies to verify the response
    response.cookies.set("auth_nonce", nonce, cookieOptions);
    response.cookies.set("auth_state", state, cookieOptions);

    return response;
  } catch (error) {
    console.error("Error initiating Azure AD login:", error);
    const baseUrl = getBaseUrlFromRequest(req);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.redirect(
      `${baseUrl}/?error=login_init_failed&details=${encodeURIComponent(
        errorMessage
      )}`
    );
  }
}

// Build the authorization URL for Azure AD
function buildAuthorizationUrl(
  req: NextRequest,
  nonce: string,
  state: string
): string {
  const baseUrl = getBaseUrlFromRequest(req);
  const redirectUri = `${baseUrl}/api/auth/callback`;

  // Azure AD authorization endpoint
  const authEndpoint = `https://login.microsoftonline.com/${AZURE_AD_TENANT_ID}/oauth2/v2.0/authorize`;

  // Build query parameters
  const params = new URLSearchParams({
    client_id: AZURE_AD_CLIENT_ID!,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "form_post",
    scope: "openid profile email",
    state: state,
    nonce: nonce,
  });

  console.log(`Authorization URL: ${authEndpoint}?${params.toString()}`);
  return `${authEndpoint}?${params.toString()}`;
}
