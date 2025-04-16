import { type NextRequest, NextResponse } from "next/server";
import { users } from "@/lib/admin";

export async function GET(req: NextRequest) {
  // Return the admin user (MD)
  const adminUser = users[0];

  if (!adminUser) {
    return NextResponse.json(
      { error: "Admin user not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    id: adminUser.id,
    username: adminUser.username,
    email: adminUser.email,
    personnelType: "Md",
  });
}
