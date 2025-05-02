import { type NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { Issue } from "@/lib/models/issues";
import dbConnect from "@/lib/db";
import nodemailer from "nodemailer";
import { getSession } from "@/lib/session";

// Define interfaces for user data
interface UserData {
  id: string;
  displayName: string;
  mail: string;
}

// Create a transporter
const transporter = nodemailer.createTransport({
  host: "192.168.192.160",
  port: 25,
  secure: false,
  tls: {
    rejectUnauthorized: false,
  },
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await context.params;

  try {
    await dbConnect();
    const issue = await Issue.findById(id);

    if (!issue) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 });
    }

    return NextResponse.json(issue);
  } catch (error) {
    console.error("Error fetching issue:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await context.params;

  try {
    await dbConnect();
    const updateData = await request.json();

    // Extract user data if provided
    const { resolverData, submitterData, ...issueUpdateData } = updateData;

    // Get the issue before updating
    const issue = await Issue.findById(id);
    if (!issue) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 });
    }

    // Check if this is a resolution update
    const isResolvingIssue =
      issueUpdateData.status === "Closed" && issue.status !== "Closed";

    const updatedIssue = await Issue.findByIdAndUpdate(id, issueUpdateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedIssue) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 });
    }

    // If this is a resolution update, send email notifications
    if (isResolvingIssue && submitterData && submitterData.mail) {
      try {
        const session = await getSession();
        const isAdmin = session?.personnelType === "Md";

        // Only send email if submitter is not anonymous
        if (
          issue.submittedBy !== "anonymous" &&
          issue.submittedBy !== "Anonymous"
        ) {
          const resolverName =
            resolverData?.displayName ||
            (isAdmin ? "Managing Director" : "Staff Member");
          const resolverEmail = resolverData?.mail || "";

          const emailContent = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Issue Resolved</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 0; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #10b981; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                .header h1 { color: white; margin: 0; font-size: 24px; }
                .content { background-color: #ffffff; padding: 20px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 5px 5px; }
                .issue-details { background-color: #f9fafb; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #10b981; }
                .resolution { background-color: #ecfdf5; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #10b981; }
                .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
                .button { display: inline-block; background-color: #10b981; color: white; text-decoration: none; padding: 10px 20px; border-radius: 5px; margin-top: 15px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Your Issue Has Been Resolved</h1>
                </div>
                <div class="content">
                  <p>Hello ${submitterData.displayName},</p>
                  <p>Your issue has been resolved by ${resolverName}${
            resolverEmail ? ` (${resolverEmail})` : ""
          }.</p>
                  <div class="issue-details">
                    <p><strong>Issue:</strong> ${updatedIssue.subject}</p>
                    <p><strong>Category:</strong> ${updatedIssue.category}</p>
                  </div>
                  <div class="resolution">
                    <p><strong>Resolution:</strong></p>
                    <p>${
                      updatedIssue.reslvedComment || "No comment provided"
                    }</p>
                  </div>
                  <p>Please don't forget to leave a rating for the resolution.</p>
                  <p>Thank you</p>
                </div>
                <div class="footer">
                  <p>This is an automated message. Please do not reply to this email.</p>
                </div>
              </div>
            </body>
            </html>
          `;

          const mailOptions = {
            from: "<askyourmd@nssfug.org>",
            to: submitterData.mail,
            subject: `Your Issue Has Been Resolved: ${updatedIssue.subject}`,
            html: emailContent,
          };

          await transporter.sendMail(mailOptions);
        }
      } catch (emailError) {
        console.error("Error sending notification email:", emailError);
      }
    }

    return NextResponse.json(updatedIssue);
  } catch (error) {
    console.error("Error updating issue:", error);

    if (error instanceof mongoose.Error.ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await context.params;

  try {
    await dbConnect();
    const deletedIssue = await Issue.findByIdAndDelete(id);

    if (!deletedIssue) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Issue deleted successfully" });
  } catch (error) {
    console.error("Error deleting issue:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
