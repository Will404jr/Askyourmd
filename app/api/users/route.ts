import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Azure AD app credentials from environment variables
const TENANT_ID =
  process.env.AZURE_AD_TENANT_ID || "708f7b5b-20fc-4bc8-9150-b1015a308b9c";
const CLIENT_ID = process.env.AZURE_AD_CLIENT_ID;
const CLIENT_SECRET = process.env.AZURE_AD_CLIENT_SECRET;

// Interface for user data
interface AzureADUser {
  id: string;
  displayName: string;
  givenName?: string;
  surname?: string;
  mail?: string;
  userPrincipalName: string;
  jobTitle?: string;
  department?: string;
  officeLocation?: string;
  mobilePhone?: string;
  businessPhones?: string[];
}

/**
 * Get an access token from Azure Active Directory
 */
async function getAccessToken(): Promise<string> {
  const url = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;

  const formData = new URLSearchParams({
    client_id: CLIENT_ID!,
    client_secret: CLIENT_SECRET!,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Failed to fetch access token: ${response.status} - ${errorText}`
      );
      throw new Error(`Failed to fetch access token: ${response.status}`);
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error("Error getting access token:", error);
    throw error;
  }
}

/**
 * Fetch users from Azure AD using Microsoft Graph API
 */
async function fetchUsers(accessToken: string): Promise<AzureADUser[]> {
  let url =
    "https://graph.microsoft.com/v1.0/users?$select=id,displayName,givenName,surname,mail,userPrincipalName,jobTitle,department,officeLocation,mobilePhone,businessPhones";
  const headers = { Authorization: `Bearer ${accessToken}` };
  const users: AzureADUser[] = [];

  try {
    while (url) {
      console.log(`Fetching users from: ${url}`);
      const response = await fetch(url, { headers });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Failed to fetch users: ${response.status} - ${errorText}`
        );
        throw new Error(`Failed to fetch users: ${response.status}`);
      }

      const data = await response.json();
      users.push(...data.value);

      // Check for more pages
      url = data["@odata.nextLink"] || "";
    }

    return users;
  } catch (error) {
    console.error("Error fetching users:", error);
    throw error;
  }
}

/**
 * API route handler for GET /api/users
 */
export async function GET(req: NextRequest) {
  try {
    // Check if we should filter users
    const { searchParams } = new URL(req.url);
    const filterByDepartment = searchParams.get("department");
    const filterByName = searchParams.get("name");

    console.log("Fetching access token...");
    const accessToken = await getAccessToken();

    console.log("Fetching users from Azure AD...");
    const users = await fetchUsers(accessToken);

    console.log(`Fetched ${users.length} users from Azure AD`);

    // Apply filters if provided
    let filteredUsers = users;

    if (filterByDepartment) {
      filteredUsers = filteredUsers.filter((user) =>
        user.department
          ?.toLowerCase()
          .includes(filterByDepartment.toLowerCase())
      );
    }

    if (filterByName) {
      filteredUsers = filteredUsers.filter(
        (user) =>
          user.displayName.toLowerCase().includes(filterByName.toLowerCase()) ||
          user.givenName?.toLowerCase().includes(filterByName.toLowerCase()) ||
          user.surname?.toLowerCase().includes(filterByName.toLowerCase())
      );
    }

    return NextResponse.json({
      users: filteredUsers,
      total: filteredUsers.length,
    });
  } catch (error) {
    console.error("Error in users API route:", error);
    return NextResponse.json(
      { error: "Failed to fetch users from Azure AD" },
      { status: 500 }
    );
  }
}

/**
 * API route handler for getting a single user by ID
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const accessToken = await getAccessToken();

    // Fetch a specific user by ID
    const url = `https://graph.microsoft.com/v1.0/users/${userId}?$select=id,displayName,givenName,surname,mail,userPrincipalName,jobTitle,department,officeLocation,mobilePhone,businessPhones`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch user: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: `Failed to fetch user: ${response.status}` },
        { status: response.status }
      );
    }

    const user = await response.json();

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Error fetching user by ID:", error);
    return NextResponse.json(
      { error: "Failed to fetch user from Azure AD" },
      { status: 500 }
    );
  }
}
