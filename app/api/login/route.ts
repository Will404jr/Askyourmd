import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { users as adminUsers } from "@/lib/adminlogin";

export async function POST(req: NextRequest) {
  try {
    console.log("Processing login request");
    const session = await getSession();
    const body = await req.json();
    const { username, password } = body;

    console.log(`Login attempt for username: ${username}`);

    // Check admin users
    const adminUser = adminUsers.find((u) => u.username === username);
    if (adminUser) {
      if (adminUser.password === password) {
        console.log("Admin user authenticated successfully");

        // Set session data
        session.id = adminUser.id;
        session.isLoggedIn = true;
        session.username = adminUser.username;
        session.email = adminUser.email;
        session.personnelType = "Md";
        session.expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

        console.log("Session before save:", {
          id: session.id,
          username: session.username,
          email: session.email,
          personnelType: session.personnelType,
          isLoggedIn: session.isLoggedIn,
          expiresAt: session.expiresAt,
        });

        try {
          await session.save();
          console.log("Session saved successfully");
        } catch (saveError) {
          console.error("Error saving session:", saveError);
          return NextResponse.json(
            { error: "Session save failed" },
            { status: 500 }
          );
        }

        return NextResponse.json({
          id: adminUser.id,
          username: adminUser.username,
          email: adminUser.email,
          personnelType: "Md",
        });
      } else {
        console.log("Invalid password for admin user");
        return NextResponse.json(
          { error: "Invalid credentials" },
          { status: 401 }
        );
      }
    }

    // If not an admin user, return error - staff should use SAML
    console.log("User not found or not an admin");
    return NextResponse.json(
      { error: "Invalid credentials. Staff should use SSO login." },
      { status: 401 }
    );
  } catch (error) {
    console.error("Error in login route:", error);
    return NextResponse.json(
      { error: "An error occurred during login" },
      { status: 500 }
    );
  }
}
