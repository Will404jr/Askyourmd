import fs from "fs";
import path from "path";
import { Strategy as SamlStrategy } from "passport-saml";

// Read the Azure AD certificate
const getCertificate = () => {
  try {
    return fs.readFileSync(
      path.join(process.cwd(), "public/certs/azuread_cert.pem"),
      "utf-8"
    );
  } catch (error) {
    console.error("Error reading SAML certificate:", error);
    return "";
  }
};

// Helper function to get the base URL
const getBaseUrl = () => {
  // In production, use the NEXT_PUBLIC_BASE_URL environment variable if available
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }

  // Default to the production URL
  return "https://askyourmd.nssfug.org";
};

// Create SAML strategy
export const createSamlStrategy = () => {
  const baseUrl = getBaseUrl();

  return new SamlStrategy(
    {
      // Using values from your Azure AD metadata
      entryPoint:
        "https://login.microsoftonline.com/708f7b5b-20fc-4bc8-9150-b1015a308b9c/saml2",
      issuer: `${baseUrl}/api/saml/metadata`,
      callbackUrl: `${baseUrl}/api/saml/callback`,
      cert: getCertificate(),
      identifierFormat: null,
      validateInResponseTo: false,
      disableRequestedAuthnContext: true,
      acceptedClockSkewMs: 300000, // 5 minutes
    },
    (profile: any, done: (error: Error | null, user?: any) => void) => {
      // Map SAML profile to user object
      try {
        const user = {
          id:
            profile.nameID ||
            profile[
              "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
            ],
          username:
            profile[
              "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname"
            ] || "",
          surname:
            profile[
              "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname"
            ] || "",
          email:
            profile[
              "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
            ] ||
            profile.mail ||
            "",
          personnelType: "Staff",
          fullName: `${
            profile[
              "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname"
            ] || ""
          } ${
            profile[
              "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname"
            ] || ""
          }`.trim(),
        };
        return done(null, user);
      } catch (error) {
        return done(error as Error);
      }
    }
  );
};

// Generate SAML metadata
export const generateSamlMetadata = () => {
  const strategy = createSamlStrategy();
  return strategy.generateServiceProviderMetadata(null, getCertificate());
};

// Parse SAML response
export const parseSamlResponse = (samlResponse: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const strategy = createSamlStrategy();

    // Check if _saml exists
    if (!strategy._saml) {
      reject(new Error("SAML strategy not properly initialized"));
      return;
    }

    try {
      // Access the internal SAML object to validate the response
      strategy._saml
        .validatePostResponseAsync({
          body: { SAMLResponse: samlResponse },
        } as any)
        .then((profile) => {
          console.log("SAML validation successful");
          resolve(profile);
        })
        .catch((err) => {
          console.error("SAML validation error:", err);
          reject(err);
        });
    } catch (error) {
      console.error("Error in parseSamlResponse:", error);
      reject(error);
    }
  });
};
