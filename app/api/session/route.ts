import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await getSession();

    // If not logged in, return unauthorized
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Return session data (excluding sensitive information)
    return NextResponse.json({
      id: session.id,
      username: session.username,
      email: session.email,
      givenName: session.givenName,
      surname: session.surname,
      personnelType: session.personnelType,
      isLoggedIn: session.isLoggedIn,
    });
  } catch (error) {
    console.error("Error in session API:", error);
    return NextResponse.json({ error: "Session error" }, { status: 500 });
  }
}
