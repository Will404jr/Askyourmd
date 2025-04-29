import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { Client } from "@microsoft/microsoft-graph-client";
import "isomorphic-fetch"; // Required for Microsoft Graph client

// Function to get Microsoft Graph client
const getGraphClient = async (accessToken: string) => {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
};

export async function GET() {
  const session = await getSession();

  // Check if user is authenticated and is an admin
  if (!session.isLoggedIn || session.personnelType !== "Md") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // In a real implementation, you would get an access token for Microsoft Graph API
    // This could be from a token exchange with the SAML token or a separate OAuth flow
    // For now, we'll use a placeholder

    // This is a placeholder for the access token
    // In production, you would get this from a token exchange or OAuth flow
    const accessToken = process.env.GRAPH_API_ACCESS_TOKEN;

    if (!accessToken) {
      return NextResponse.json(
        { error: "Graph API access token not configured" },
        { status: 500 }
      );
    }

    // Get Microsoft Graph client
    const graphClient = await getGraphClient(accessToken);

    // Fetch users from Microsoft Graph API
    const response = await graphClient
      .api("/users")
      .select("id,givenName,surname,mail,userPrincipalName")
      .top(50) // Limit to 50 users
      .get();

    // Map Microsoft Graph users to our user model
    const users = response.value.map((user: any) => ({
      id: user.id,
      username: user.givenName,
      surname: user.surname,
      email: user.mail,
      name: user.userPrincipalName,
      uniqueId: user.userPrincipalName,
      personnelType: "Staff",
    }));

    return NextResponse.json(users);
  } catch (error) {
    console.error("Error fetching users from Microsoft Graph:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
