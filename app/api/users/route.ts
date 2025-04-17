import { type NextRequest, NextResponse } from "next/server";

// Flask API configuration
const FLASK_USERS_URL = "http://localhost:5000/users"; // Update to your Flask server URL

export async function GET(req: NextRequest) {
  try {
    const response = await fetch(FLASK_USERS_URL);
    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch users from Flask API" },
        { status: response.status }
      );
    }
    const users = await response.json();
    return NextResponse.json(users);
  } catch (error) {
    console.error("Error fetching users from Flask API:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
