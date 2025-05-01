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
    console.log("Stateless Azure AD login initiated");

    // Check if Azure AD configuration is available
    if (!AZURE_AD_CLIENT_ID) {
      console.error("Azure AD Client ID is not configured");
      const baseUrl = getBaseUrlFromRequest(req);
      return NextResponse.redirect(`${baseUrl}/?error=missing_client_id`);
    }

    // Generate a nonce for OIDC flow - we won't validate this in the stateless flow
    const nonce = uuidv4();

    // Build the authorization URL without state validation
    const authUrl = buildAuthorizationUrl(req, nonce);
    console.log(`Redirecting to Azure AD (stateless): ${authUrl}`);

    return NextResponse.redirect(authUrl);
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

// Build the authorization URL for Azure AD without state validation
function buildAuthorizationUrl(req: NextRequest, nonce: string): string {
  const baseUrl = getBaseUrlFromRequest(req);
  const redirectUri = `${baseUrl}/api/auth/callback`;

  console.log(`Redirect URI: ${redirectUri}`);

  // Azure AD authorization endpoint
  const authEndpoint = `https://login.microsoftonline.com/${AZURE_AD_TENANT_ID}/oauth2/v2.0/authorize`;

  // Build query parameters - no state parameter for stateless flow
  const params = new URLSearchParams({
    client_id: AZURE_AD_CLIENT_ID!,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "form_post",
    scope: "openid profile email",
    nonce: nonce,
  });

  return `${authEndpoint}?${params.toString()}`;
}
