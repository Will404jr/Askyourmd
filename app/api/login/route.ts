import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { users as adminUsers } from "@/lib/adminlogin";

export async function POST(req: NextRequest) {
  const session = await getSession();
  const body = await req.json();
  const { username, password } = body;

  // Check admin users
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

  // If not an admin user, return error
  return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
}
