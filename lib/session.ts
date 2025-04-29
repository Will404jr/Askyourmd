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
  expiresAt?: number; // Add expiration time
  destroy: () => Promise<void>;
  save: () => Promise<void>;
}

const sessionOptions = {
  password:
    process.env.SESSION_PASSWORD ||
    "complex_password_at_least_32_characters_long",
  cookieName: "auth-session",
  cookieOptions: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60, // 24 hours in seconds
  },
};

export async function getSession() {
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions
  );

  if (!session.isLoggedIn) {
    session.isLoggedIn = false;
  }

  // Check if the session has expired
  if (session.expiresAt && Date.now() > session.expiresAt) {
    await session.destroy();
    session.isLoggedIn = false;
  }

  return session;
}
