import { NextResponse } from "next/server";
import { generateSamlMetadata } from "@/lib/saml";

export async function GET() {
  try {
    const metadata = generateSamlMetadata();

    return new NextResponse(metadata, {
      status: 200,
      headers: {
        "Content-Type": "application/xml",
      },
    });
  } catch (error) {
    console.error("Error generating SAML metadata:", error);
    return NextResponse.json(
      { error: "Failed to generate SAML metadata" },
      { status: 500 }
    );
  }
}
