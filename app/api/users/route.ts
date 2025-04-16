import { type NextRequest, NextResponse } from "next/server";
import ldapjs from "ldapjs";

// LDAP configuration for Forum Systems test server
const ldapConfig = {
  url: "ldap://ldap.forumsys.com:389",
  baseDN: "dc=example,dc=com",
  bindDN: "cn=read-only-admin,dc=example,dc=com",
  bindPassword: "password",
};

export async function GET(req: NextRequest) {
  return new Promise((resolve) => {
    const client = ldapjs.createClient({
      url: ldapConfig.url,
    });

    client.on("error", (err) => {
      resolve(
        NextResponse.json({ error: "LDAP connection failed" }, { status: 500 })
      );
    });

    // Bind with service account
    client.bind(ldapConfig.bindDN, ldapConfig.bindPassword, (err) => {
      if (err) {
        client.unbind();
        resolve(
          NextResponse.json({ error: "LDAP bind failed" }, { status: 500 })
        );
        return;
      }

      // Search for all users
      const searchOptions: ldapjs.SearchOptions = {
        scope: "sub" as "sub",
        filter: "(objectClass=inetOrgPerson)", // Filter for user entries
        attributes: ["uid", "mail", "cn"], // Fetch username, email, and common name
      };

      const users: { uid: string; mail?: string; cn: string }[] = [];

      client.search(ldapConfig.baseDN, searchOptions, (err, res) => {
        if (err) {
          client.unbind();
          resolve(
            NextResponse.json({ error: "LDAP search failed" }, { status: 500 })
          );
          return;
        }

        res.on("searchEntry", (entry) => {
          users.push({
            uid: entry.attributes.find((a) => a.type === "uid")
              ?.values[0] as string,
            mail: entry.attributes.find((a) => a.type === "mail")?.values[0] as
              | string
              | undefined, // Email may not always exist
            cn: entry.attributes.find((a) => a.type === "cn")
              ?.values[0] as string,
          });
        });

        res.on("error", (err) => {
          client.unbind();
          resolve(
            NextResponse.json({ error: "LDAP search error" }, { status: 500 })
          );
        });

        res.on("end", () => {
          client.unbind();
          resolve(NextResponse.json(users));
        });
      });
    });
  });
}
