// Azure AD app credentials from environment variables
const TENANT_ID =
  process.env.AZURE_AD_TENANT_ID || "708f7b5b-20fc-4bc8-9150-b1015a308b9c";
const CLIENT_ID = process.env.AZURE_AD_CLIENT_ID;
const CLIENT_SECRET = process.env.AZURE_AD_CLIENT_SECRET;

/**
 * Get an access token from Azure Active Directory
 */
export async function getAccessToken(): Promise<string> {
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
 * Make a request to Microsoft Graph API
 */
export async function graphRequest<T>(
  endpoint: string,
  accessToken?: string
): Promise<T> {
  // Get access token if not provided
  if (!accessToken) {
    accessToken = await getAccessToken();
  }

  const url = `https://graph.microsoft.com/v1.0${endpoint}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Graph API error: ${response.status} - ${errorText}`);
    throw new Error(`Graph API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Interface for user data from Azure AD
 */
export interface AzureADUser {
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
 * Fetch all users from Azure AD
 */
export async function fetchAllUsers(
  accessToken?: string
): Promise<AzureADUser[]> {
  if (!accessToken) {
    accessToken = await getAccessToken();
  }

  const url =
    "/users?$select=id,displayName,givenName,surname,mail,userPrincipalName,jobTitle,department,officeLocation,mobilePhone,businessPhones";
  const users: AzureADUser[] = [];

  try {
    let nextLink = url;

    while (nextLink) {
      const data = await graphRequest<{
        value: AzureADUser[];
        "@odata.nextLink"?: string;
      }>(nextLink, accessToken);

      users.push(...data.value);
      nextLink = data["@odata.nextLink"]
        ? data["@odata.nextLink"].replace(
            "https://graph.microsoft.com/v1.0",
            ""
          )
        : "";
    }

    return users;
  } catch (error) {
    console.error("Error fetching all users:", error);
    throw error;
  }
}

/**
 * Get a user by ID
 */
export async function getUserById(
  userId: string,
  accessToken?: string
): Promise<AzureADUser> {
  return graphRequest<AzureADUser>(
    `/users/${userId}?$select=id,displayName,givenName,surname,mail,userPrincipalName,jobTitle,department,officeLocation,mobilePhone,businessPhones`,
    accessToken
  );
}

/**
 * Search users by query
 */
export async function searchUsers(
  query: string,
  accessToken?: string
): Promise<AzureADUser[]> {
  const data = await graphRequest<{ value: AzureADUser[] }>(
    `/users?$filter=startswith(displayName,'${query}') or startswith(givenName,'${query}') or startswith(surname,'${query}') or startswith(mail,'${query}')&$select=id,displayName,givenName,surname,mail,userPrincipalName,jobTitle,department`,
    accessToken
  );

  return data.value;
}

/**
 * Get all unique departments
 */
export async function getAllDepartments(
  accessToken?: string
): Promise<string[]> {
  if (!accessToken) {
    accessToken = await getAccessToken();
  }

  const users = await fetchAllUsers(accessToken);
  const departments = new Set<string>();

  users.forEach((user) => {
    if (user.department && user.department.trim() !== "") {
      departments.add(user.department.trim());
    }
  });

  return Array.from(departments).sort();
}
