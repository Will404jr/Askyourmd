import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { type User as AdminUser, users as adminUsers } from "@/lib/adminlogin";
import { type User as StaffUser } from "@/lib/user";
import ldapjs from "ldapjs";

// LDAP configuration for Forum Systems test server
const ldapConfig = {
  url: "ldap://54.80.223.88:389", // Use LDAP for testing
  baseDN: "dc=example,dc=com",
  bindDN: "cn=read-only-admin,dc=example,dc=com", // Service account for searching
  bindPassword: "password",
};

async function authenticateLDAP(
  username: string,
  password: string
): Promise<StaffUser | null> {
  return new Promise((resolve, reject) => {
    const client = ldapjs.createClient({
      url: ldapConfig.url,
    });

    client.on("error", (err) => {
      reject(err);
    });

    // Bind with service account to search for user
    client.bind(ldapConfig.bindDN, ldapConfig.bindPassword, (err) => {
      if (err) {
        client.unbind();
        return reject(err);
      }

      // Search for user by uid
      const searchOptions = {
        scope: "sub" as "sub",
        filter: `(uid=${username})`,
        attributes: ["uid", "mail", "cn"],
      };

      client.search(ldapConfig.baseDN, searchOptions, (err, res) => {
        if (err) {
          client.unbind();
          return reject(err);
        }

        let userData: any = null;

        res.on("searchEntry", (entry) => {
          // Extract attributes correctly from the LDAP entry
          const attributes = entry.pojo.attributes;

          // Create a properly structured user object
          userData = {
            uid:
              attributes.find((attr: any) => attr.type === "uid")?.values[0] ||
              "",
            mail:
              attributes.find((attr: any) => attr.type === "mail")?.values[0] ||
              "",
            cn:
              attributes.find((attr: any) => attr.type === "cn")?.values[0] ||
              "",
          };

          console.log("LDAP user data:", userData); // Debug log
        });

        res.on("end", async () => {
          if (!userData) {
            client.unbind();
            return resolve(null);
          }

          // Verify password by binding with user credentials
          const userDN = `uid=${username},dc=example,dc=com`;
          const userClient = ldapjs.createClient({ url: ldapConfig.url });

          userClient.bind(userDN, password, (err) => {
            client.unbind();
            userClient.unbind();

            if (err) {
              return resolve(null);
            }

            resolve({
              id: userData.uid, // Use uid as id
              username: userData.cn, // Use cn as username
              email: userData.mail || `${username}@example.com`, // Fallback email
              personnelType: "Staff",
            });
          });
        });

        res.on("error", (err) => {
          client.unbind();
          reject(err);
        });
      });
    });
  });
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

  // Try LDAP authentication for staff
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
    console.error("LDAP authentication error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}
