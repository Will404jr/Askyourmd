import { NextResponse } from "next/server";
import Pusher from "pusher";
import { getSession } from "@/lib/session";
import dbConnect from "@/lib/db";
import { Message } from "@/lib/models/Message";
import { users } from "@/lib/adminlogin";

// Define user interfaces
interface AzureADUser {
  id: string;
  displayName: string;
  givenName?: string;
  surname?: string;
  mail?: string;
  userPrincipalName: string;
  jobTitle?: string;
  department?: string;
  personnelType?: string;
}

type User = AzureADUser | null;

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

// Helper function to get user by ID from Azure AD or admin list
async function getUserById(userId: string): Promise<User> {
  // Check if this is the admin user
  if (userId === "admin") {
    const adminUser = users[0];
    return {
      id: adminUser.id,
      displayName: adminUser.username,
      mail: adminUser.email,
      userPrincipalName: adminUser.email,
      personnelType: "Md",
    };
  }

  try {
    // Fetch user from Azure AD API
    const response = await fetch("http://localhost:3001/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user: ${response.status}`);
    }

    const data = await response.json();
    return data.user;
  } catch (error) {
    console.error("Error fetching user from Azure AD:", error);
    return null;
  }
}

export async function POST(req: Request) {
  const session = await getSession();

  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  console.log("Received request body:", body);

  const { senderId, recipientId, message, content } = body;

  if (!message && !content) {
    return NextResponse.json(
      { error: "Message content is required" },
      { status: 400 }
    );
  }

  const messageContent = message || content;

  try {
    // Get sender and recipient information
    const sender = await getUserById(senderId);
    const recipient = await getUserById(recipientId);

    if (!sender || !recipient) {
      return NextResponse.json(
        { error: "Invalid sender or recipient" },
        { status: 400 }
      );
    }

    // Verify that the sender matches the session user
    if (sender.id !== session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if the communication is allowed (Staff to MD or MD to anyone)
    const isMd = session.personnelType === "Md" || senderId === "admin";
    const recipientIsMd = recipientId === "admin";

    if (!isMd && !recipientIsMd) {
      return NextResponse.json(
        { error: "Communication not allowed" },
        { status: 403 }
      );
    }

    // Connect to the database
    await dbConnect();

    // Store the message in the database
    const newMessage = new Message({
      senderId,
      recipientId,
      message: messageContent,
      read: false, // Ensure new messages are marked as unread
    });

    try {
      const savedMessage = await newMessage.save();
      console.log("Saved message:", savedMessage);
    } catch (error) {
      console.error("Error saving message:", error);
      return NextResponse.json(
        { error: "Failed to save message" },
        { status: 500 }
      );
    }

    try {
      await pusher.trigger(`private-user-${recipientId}`, "new-message", {
        sender: {
          id: sender.id,
          username: sender.displayName,
          email: sender.mail || sender.userPrincipalName,
          personnelType: isMd ? "Md" : "Staff",
        },
        message: messageContent,
      });
    } catch (error) {
      console.error("Error triggering Pusher event:", error);
      // Note: We don't return here because the message was saved successfully
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing message:", error);
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
}
