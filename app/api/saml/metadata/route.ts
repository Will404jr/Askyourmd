import { NextResponse } from "next/server";
import { generateSamlMetadata } from "@/lib/saml";

export async function GET() {
  try {
    console.log("Generating SAML metadata for /api/saml/metadata endpoint");
    const metadata = generateSamlMetadata();

    if (!metadata || metadata.includes("Error:")) {
      console.error("Failed to generate valid SAML metadata");
      return new NextResponse("Failed to generate SAML metadata", {
        status: 500,
        headers: {
          "Content-Type": "text/plain",
        },
      });
    }

    return new NextResponse(metadata, {
      status: 200,
      headers: {
        "Content-Type": "application/xml",
      },
    });
  } catch (error) {
    console.error("Error in SAML metadata endpoint:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: "Failed to generate SAML metadata", details: errorMessage },
      { status: 500 }
    );
  }
}
