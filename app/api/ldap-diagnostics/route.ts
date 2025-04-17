import { NextResponse } from "next/server";
import ldapjs from "ldapjs";
import dns from "dns";
import { promisify } from "util";
import net from "net";

// LDAP configuration
const ldapConfig = {
  url: "ldap://54.80.223.88:389",
  baseDN: "dc=example,dc=com",
  bindDN: "cn=read-only-admin,dc=example,dc=com",
  bindPassword: "password",
  timeout: 10000,
  connectTimeout: 10000,
};

// Promisify DNS lookup
const lookup = promisify(dns.lookup);

// Test TCP connection
async function testTcpConnection(
  host: string,
  port: number
): Promise<{ success: boolean; time: number; error?: string }> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const socket = net.createConnection(port, host);
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve({
        success: false,
        time: Date.now() - startTime,
        error: "Connection timeout",
      });
    }, 5000);

    socket.on("connect", () => {
      clearTimeout(timeout);
      socket.end();
      resolve({ success: true, time: Date.now() - startTime });
    });

    socket.on("error", (err) => {
      clearTimeout(timeout);
      resolve({
        success: false,
        time: Date.now() - startTime,
        error: err.message,
      });
    });
  });
}

// Test DNS resolution
async function testDnsResolution(
  hostname: string
): Promise<{ success: boolean; ip?: string; error?: string }> {
  try {
    const { address } = await lookup(hostname);
    return { success: true, ip: address };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Test LDAP connection
async function testLdapConnection(): Promise<{
  success: boolean;
  error?: string;
  bindSuccess?: boolean;
}> {
  return new Promise((resolve) => {
    try {
      const client = ldapjs.createClient({
        url: ldapConfig.url,
        timeout: ldapConfig.timeout,
        connectTimeout: ldapConfig.connectTimeout,
      });

      const connectionTimeout = setTimeout(() => {
        resolve({ success: false, error: "LDAP connection timeout" });
      }, ldapConfig.connectTimeout + 1000);

      client.on("error", (err) => {
        clearTimeout(connectionTimeout);
        resolve({
          success: false,
          error: `LDAP connection error: ${err.message}`,
        });
      });

      client.on("connect", () => {
        clearTimeout(connectionTimeout);

        // Test binding
        client.bind(ldapConfig.bindDN, ldapConfig.bindPassword, (err) => {
          if (err) {
            client.unbind();
            resolve({
              success: true,
              bindSuccess: false,
              error: `LDAP bind error: ${err.message}`,
            });
          } else {
            client.unbind();
            resolve({ success: true, bindSuccess: true });
          }
        });
      });
    } catch (error) {
      resolve({
        success: false,
        error: `LDAP client creation error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  });
}

// Test LDAP search
async function testLdapSearch(): Promise<{
  success: boolean;
  error?: string;
  entries?: number;
  firstEntry?: any;
}> {
  return new Promise((resolve) => {
    try {
      const client = ldapjs.createClient({
        url: ldapConfig.url,
        timeout: ldapConfig.timeout,
        connectTimeout: ldapConfig.connectTimeout,
      });

      client.on("error", (err) => {
        resolve({
          success: false,
          error: `LDAP connection error: ${err.message}`,
        });
      });

      client.bind(ldapConfig.bindDN, ldapConfig.bindPassword, (err) => {
        if (err) {
          client.unbind();
          resolve({ success: false, error: `LDAP bind error: ${err.message}` });
          return;
        }

        // Search for all entries
        const searchOptions = {
          scope: "sub" as const,
          filter: "(objectClass=*)",
          attributes: ["uid", "cn", "objectClass"],
          sizeLimit: 5, // Limit to 5 entries for the test
        };

        client.search(ldapConfig.baseDN, searchOptions, (err, res) => {
          if (err) {
            client.unbind();
            resolve({
              success: false,
              error: `LDAP search error: ${err.message}`,
            });
            return;
          }

          let entries = 0;
          let firstEntry: any = null;

          res.on("searchEntry", (entry) => {
            entries++;
            if (!firstEntry) {
              firstEntry = {
                dn: entry.pojo.objectName,
                attributes: entry.pojo.attributes.map((attr: any) => ({
                  type: attr.type,
                  values: attr.values,
                })),
              };
            }
          });

          res.on("error", (err) => {
            client.unbind();
            resolve({
              success: false,
              error: `LDAP search response error: ${err.message}`,
            });
          });

          res.on("end", () => {
            client.unbind();
            resolve({ success: true, entries, firstEntry });
          });
        });
      });
    } catch (error) {
      resolve({
        success: false,
        error: `LDAP search test error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  });
}

// Get environment info
function getEnvironmentInfo() {
  return {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    env: process.env.NODE_ENV,
    memoryUsage: process.memoryUsage(),
  };
}

export async function GET() {
  try {
    // Run all tests
    const [
      envInfo,
      dnsResult,
      tcpResult,
      ldapConnectionResult,
      ldapSearchResult,
    ] = await Promise.all([
      getEnvironmentInfo(),
      testDnsResolution("54.80.223.88"),
      testTcpConnection("54.80.223.88", 389),
      testLdapConnection(),
      testLdapSearch(),
    ]);

    // Collect all results
    const diagnosticResults = {
      timestamp: new Date().toISOString(),
      environment: envInfo,
      networkTests: {
        dns: dnsResult,
        tcp: tcpResult,
      },
      ldapTests: {
        connection: ldapConnectionResult,
        search: ldapSearchResult,
      },
      ldapConfig: {
        url: ldapConfig.url,
        baseDN: ldapConfig.baseDN,
        bindDN: ldapConfig.bindDN,
        // Don't include password in the response
        timeout: ldapConfig.timeout,
        connectTimeout: ldapConfig.connectTimeout,
      },
    };

    return NextResponse.json(diagnosticResults);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Diagnostic test failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
