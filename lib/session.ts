import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  id?: string;
  isLoggedIn: boolean;
  username?: string;
  email?: string;
  givenName?: string;
  surname?: string;
  userPrincipalName?: string;
  personnelType?: string;
  expiresAt?: number;
  destroy: () => Promise<void>;
  save: () => Promise<void>;
}

const sessionOptions = {
  password:
    process.env.SESSION_PASSWORD ||
    "complex_password_at_least_32_characters_long",
  cookieName: "auth-session",
  cookieOptions: {
    // Set secure to true only in production
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 24 * 60 * 60, // 24 hours in seconds
    // Important for cookies to work with a reverse proxy
    sameSite: "lax" as const,
    // Don't set domain to allow the cookie to work with the proxy
    path: "/",
  },
};

export async function getSession() {
  try {
    console.log("Getting session with options:", {
      cookieName: sessionOptions.cookieName,
      secure: sessionOptions.cookieOptions.secure,
      sameSite: sessionOptions.cookieOptions.sameSite,
    });

    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(
      cookieStore,
      sessionOptions
    );

    console.log("Session retrieved:", {
      isLoggedIn: session.isLoggedIn,
      username: session.username,
      personnelType: session.personnelType,
      expiresAt: session.expiresAt,
    });

    if (!session.isLoggedIn) {
      session.isLoggedIn = false;
    }

    // Check if the session has expired
    if (session.expiresAt && Date.now() > session.expiresAt) {
      console.log("Session expired, destroying");
      await session.destroy();
      session.isLoggedIn = false;
    }

    return session;
  } catch (error) {
    console.error("Error getting session:", error);
    // Return a default session if there's an error
    const cookieStore = cookies();
    return {
      isLoggedIn: false,
      async save() {
        console.log("Saving default session (error recovery)");
        // Implementation will be provided by iron-session
      },
      async destroy() {
        console.log("Destroying default session (error recovery)");
        // Implementation will be provided by iron-session
      },
    } as SessionData;
  }
}
