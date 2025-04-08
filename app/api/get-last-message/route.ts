import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { Message } from "@/lib/models/Message";
import { getSession } from "@/lib/session";

export async function GET(req: Request) {
  const session = await getSession();

  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  const otherUserId = url.searchParams.get("otherUserId");

  if (!userId || !otherUserId) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  // Verify that the user requesting messages is the logged-in user
  if (userId !== session.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();

  // Find only the most recent message between the two users
  const lastMessage = await Message.findOne({
    $or: [
      { senderId: userId, recipientId: otherUserId },
      { senderId: otherUserId, recipientId: userId },
    ],
  }).sort({ timestamp: -1 }); // Sort by timestamp descending to get the most recent

  if (!lastMessage) {
    // Return null if no messages exist between these users
    return NextResponse.json(null);
  }

  return NextResponse.json(lastMessage);
}
