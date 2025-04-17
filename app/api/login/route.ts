import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { type User as AdminUser, users as adminUsers } from "@/lib/adminlogin";
import { type User as StaffUser } from "@/lib/user";

// Flask API configuration
const FLASK_API_URL = "http://localhost:5000/auth"; // Update to your Flask server URL

async function authenticateLDAP(
  username: string,
  password: string
): Promise<StaffUser | null> {
  try {
    const response = await fetch(FLASK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        id: data.id,
        username: data.username,
        email: data.email,
        personnelType: data.personnelType,
      };
    } else {
      console.error("Flask auth error:", await response.text());
      return null;
    }
  } catch (error) {
    console.error("Error calling Flask API:", error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const body = await req.json();
  const { username, password } = body;

  // Check admin users first
  const adminUser = adminUsers.find((u) => u.username === username);
  if (adminUser) {
    if (adminUser.password === password) {
      session.id = adminUser.id;
      session.isLoggedIn = true;
      session.username = adminUser.username;
      session.email = adminUser.email;
      session.personnelType = "Md";
      session.expiresAt = Date.now() + 24 * 60 * 60 * 1000;

      await session.save();

      return NextResponse.json({
        id: adminUser.id,
        username: adminUser.username,
        email: adminUser.email,
        personnelType: "Md",
      });
    } else {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }
  }

  // Try LDAP authentication via Flask for staff
  try {
    const staffUser = await authenticateLDAP(username, password);

    console.log("Staff user after authentication:", staffUser); // Debug log

    if (staffUser) {
      session.id = staffUser.id;
      session.isLoggedIn = true;
      session.username = staffUser.username;
      session.email = staffUser.email;
      session.personnelType = "Staff";
      session.expiresAt = Date.now() + 24 * 60 * 60 * 1000;

      console.log("Session before save:", {
        id: session.id,
        username: session.username,
        email: session.email,
      }); // Debug log

      await session.save();

      return NextResponse.json({
        id: staffUser.id,
        username: staffUser.username,
        email: staffUser.email,
        personnelType: "Staff",
      });
    } else {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("Authentication error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}
