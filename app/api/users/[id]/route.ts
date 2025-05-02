import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAccessToken } from "@/lib/azure-ad";

// Azure AD app credentials from environment variables
const TENANT_ID =
  process.env.AZURE_AD_TENANT_ID || "708f7b5b-20fc-4bc8-9150-b1015a308b9c";
const CLIENT_ID = process.env.AZURE_AD_CLIENT_ID;
const CLIENT_SECRET = process.env.AZURE_AD_CLIENT_SECRET;

/**
 * Fetch a single user from Azure AD by ID
 */
async function fetchUserById(userId: string, accessToken: string) {
  try {
    // Handle special case for admin user
    if (userId === "admin") {
      return {
        id: "admin",
        displayName: "Managing Director",
        mail: "admin@example.com",
        userPrincipalName: "admin@example.com",
        jobTitle: "Managing Director",
        department: "Management",
        personnelType: "Md",
      };
    }

    const url = `https://graph.microsoft.com/v1.0/users/${userId}?$select=id,displayName,givenName,surname,mail,userPrincipalName,jobTitle,department,officeLocation,mobilePhone,businessPhones`;

    console.log(`Fetching user details for ID: ${userId}`);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch user: ${response.status} - ${errorText}`);
      throw new Error(`Failed to fetch user: ${response.status}`);
    }

    const user = await response.json();
    return user;
  } catch (error) {
    console.error(`Error fetching user by ID ${userId}:`, error);
    throw error;
  }
}

/**
 * API route handler for GET /api/users/[id]
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const userId = params.id;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    console.log(`Getting user details for ID: ${userId}`);

    // Get access token for Microsoft Graph API
    const accessToken = await getAccessToken();

    // Fetch the user by ID
    const user = await fetchUserById(userId, accessToken);

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Error in user by ID API route:", error);
    return NextResponse.json(
      { error: "Failed to fetch user from Azure AD" },
      { status: 500 }
    );
  }
}
