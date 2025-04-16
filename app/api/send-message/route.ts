import { NextResponse } from "next/server";
import Pusher from "pusher";
import { getSession } from "@/lib/session";
import dbConnect from "@/lib/db";
import { Message } from "@/lib/models/Message";
import { users as adminUsers } from "@/lib/admin";
import ldapjs from "ldapjs";

// Define user interfaces
interface AdminUser {
  id: string;
  username: string;
  email: string;
  personnelType: "Md";
}

interface StaffUser {
  id: string;
  username: string;
  email: string;
  personnelType: "Staff";
}

type User = AdminUser | StaffUser | null;

// LDAP configuration for Forum Systems test server
const ldapConfig = {
  url: "ldap://ldap.forumsys.com:389",
  baseDN: "dc=example,dc=com",
  bindDN: "cn=read-only-admin,dc=example,dc=com",
  bindPassword: "password",
};

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

// Helper function to get user by ID
async function getUserById(userId: string): Promise<User> {
  // Check if user is an admin
  const adminUser = adminUsers.find((u) => u.id === userId);
  if (adminUser) {
    return {
      id: adminUser.id,
      username: adminUser.username,
      email: adminUser.email,
      personnelType: "Md",
    };
  }

  // If not admin, check LDAP for staff users
  return new Promise<User>((resolve, reject) => {
    const client = ldapjs.createClient({
      url: ldapConfig.url,
    });

    client.on("error", (err) => {
      client.unbind();
      reject(err);
    });

    // Bind with service account to search for user
    client.bind(ldapConfig.bindDN, ldapConfig.bindPassword, (err) => {
      if (err) {
        client.unbind();
        return reject(err);
      }

      // Search for user by uid (which we use as id)
      const searchOptions = {
        scope: "sub" as const,
        filter: `(uid=${userId})`,
        attributes: ["uid", "mail", "cn"],
      };

      client.search(ldapConfig.baseDN, searchOptions, (err, res) => {
        if (err) {
          client.unbind();
          return reject(err);
        }

        let userData: StaffUser | null = null;

        res.on("searchEntry", (entry) => {
          // Extract attributes correctly from the LDAP entry
          const attributes = entry.pojo.attributes;

          const uid = attributes.find((attr: any) => attr.type === "uid")
            ?.values[0];
          const mail = attributes.find((attr: any) => attr.type === "mail")
            ?.values[0];
          const cn = attributes.find((attr: any) => attr.type === "cn")
            ?.values[0];

          if (uid) {
            // Create a properly structured user object
            userData = {
              id: uid,
              email: mail || `${uid}@example.com`,
              username: cn || uid,
              personnelType: "Staff",
            };
          }
        });

        res.on("end", () => {
          client.unbind();
          resolve(userData);
        });

        res.on("error", (err) => {
          client.unbind();
          reject(err);
        });
      });
    });
  });
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
    if (sender.personnelType !== "Md" && recipient.personnelType !== "Md") {
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
        sender,
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
