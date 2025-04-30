import fs from "fs";
import path from "path";
import { Strategy as SamlStrategy } from "passport-saml";

// Read the Azure AD certificate
const getCertificate = () => {
  try {
    const certPath = path.join(process.cwd(), "public/certs/azuread_cert.pem");
    console.log("Reading certificate from:", certPath);

    const cert = fs.readFileSync(certPath, "utf-8");
    console.log("Certificate loaded, length:", cert.length);
    return cert;
  } catch (error) {
    console.error("Error reading SAML certificate:", error);
    return "";
  }
};

// Helper function to get the base URL
const getBaseUrl = () => {
  // In production, use the NEXT_PUBLIC_BASE_URL environment variable if available
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    console.log(
      "Using NEXT_PUBLIC_BASE_URL:",
      process.env.NEXT_PUBLIC_BASE_URL
    );
    return process.env.NEXT_PUBLIC_BASE_URL;
  }

  // Default to the production URL
  console.log("Using default base URL: https://askyourmd.nssfug.org");
  return "https://askyourmd.nssfug.org";
};

// Create SAML strategy
export const createSamlStrategy = () => {
  const baseUrl = getBaseUrl();
  console.log("Creating SAML strategy with base URL:", baseUrl);

  const samlOptions = {
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
    // Add these options to help with debugging
    wantAssertionsSigned: false,
    wantAuthnResponseSigned: false,
  };

  console.log("SAML strategy options:", {
    entryPoint: samlOptions.entryPoint,
    issuer: samlOptions.issuer,
    callbackUrl: samlOptions.callbackUrl,
    certLength: samlOptions.cert?.length || 0,
  });

  return new SamlStrategy(
    samlOptions,
    (profile: any, done: (error: Error | null, user?: any) => void) => {
      // Map SAML profile to user object
      try {
        console.log("SAML profile received in strategy:", profile);

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
        console.error("Error in SAML strategy callback:", error);
        return done(error as Error);
      }
    }
  );
};

// Generate SAML metadata
export const generateSamlMetadata = () => {
  console.log("Generating SAML metadata");
  const strategy = createSamlStrategy();
  const metadata = strategy.generateServiceProviderMetadata(
    null,
    getCertificate()
  );
  console.log("SAML metadata generated, length:", metadata.length);
  return metadata;
};

// Parse SAML response
export const parseSamlResponse = (samlResponse: string): Promise<any> => {
  console.log("Parsing SAML response, length:", samlResponse.length);

  return new Promise((resolve, reject) => {
    const strategy = createSamlStrategy();

    // Check if _saml exists
    if (!strategy._saml) {
      console.error("SAML strategy not properly initialized");
      reject(new Error("SAML strategy not properly initialized"));
      return;
    }

    try {
      console.log("Validating SAML response");

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
