import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const certPath = path.join(process.cwd(), "public/certs/AskYourMDapp.pem");

    // Check if the certificate file exists
    const exists = fs.existsSync(certPath);

    if (!exists) {
      return NextResponse.json(
        {
          status: "error",
          message: "Certificate file not found",
          path: certPath,
        },
        { status: 404 }
      );
    }

    // Read the certificate
    const cert = fs.readFileSync(certPath, "utf-8");

    // Check if the certificate is empty
    if (!cert || cert.trim() === "") {
      return NextResponse.json(
        {
          status: "error",
          message: "Certificate file is empty",
          path: certPath,
        },
        { status: 400 }
      );
    }

    // Return basic info about the certificate
    return NextResponse.json({
      status: "success",
      message: "Certificate found and loaded",
      path: certPath,
      length: cert.length,
      preview: cert.substring(0, 50) + "...", // Just show the beginning
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: "Error checking certificate",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
