import { type NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { Issue } from "@/lib/models/issues";
import dbConnect from "@/lib/db";
import { getSession } from "@/lib/session";
import nodemailer from "nodemailer";

// Create a transporter
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: "wjr46269@gmail.com",
    pass: "sqdqsloslcftavja",
  },
});

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await context.params;
  try {
    await dbConnect();

    const { status, reslvedComment } = await request.json();

    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const issue = await Issue.findById(id);
    if (!issue) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 });
    }

    // Check if the user is authorized to resolve the issue
    const isAdmin = session.personnelType === "Md";
    if (!isAdmin && issue.assignedTo !== session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Update the issue
    const updatedIssue = await Issue.findByIdAndUpdate(
      id,
      {
        status,
        reslvedComment,
        // If admin is resolving an unassigned issue, assign it to them
        ...(isAdmin && !issue.assignedTo ? { assignedTo: session.id } : {}),
      },
      {
        new: true,
        runValidators: true,
      }
    );

    // Send email notification
    try {
      // Only send email if submitter is not anonymous
      if (
        issue.submittedBy !== "anonymous" &&
        issue.submittedBy !== "Anonymous"
      ) {
        // Fetch submitter details
        const submitterResponse = await fetch(
          `${process.env.BASE_URL || "https://askyourmd.nssfug.org"}/api/users`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ userId: issue.submittedBy }),
          }
        );

        if (submitterResponse.ok) {
          const submitterData = await submitterResponse.json();
          const submitter = submitterData.user;

          if (submitter && submitter.mail) {
            let emailContent;

            if (isAdmin) {
              // Email content when resolved by admin
              emailContent = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                  <h2 style="color: #1d4ed8;">Your Issue Has Been Resolved</h2>
                  <p>Hello ${submitter.displayName},</p>
                  <p>Your issue has been resolved by the Managing Director.</p>
                  <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; margin: 15px 0;">
                    <p><strong>Issue:</strong> ${updatedIssue.subject}</p>
                    <p><strong>Category:</strong> ${updatedIssue.category}</p>
                    <p><strong>Resolution:</strong> ${
                      updatedIssue.reslvedComment || "No comment provided"
                    }</p>
                  </div>
                  <p>Please don't forget to leave a rating for the resolution.</p>
                  <p>Thank you,<br>Issue Management System</p>
                </div>
              `;
            } else {
              // Fetch resolver details
              const resolverResponse = await fetch(
                `${
                  process.env.BASE_URL || "https://askyourmd.nssfug.org"
                }/api/users`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ userId: issue.assignedTo }),
                }
              );

              let resolverName = "Staff Member";
              let resolverEmail = "";

              if (resolverResponse.ok) {
                const resolverData = await resolverResponse.json();
                const resolver = resolverData.user;
                if (resolver) {
                  resolverName = resolver.displayName;
                  resolverEmail = resolver.mail || "";
                }
              }

              // Email content when resolved by staff
              emailContent = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                  <h2 style="color: #1d4ed8;">Your Issue Has Been Resolved</h2>
                  <p>Hello ${submitter.displayName},</p>
                  <p>Your issue has been resolved by ${resolverName}${
                resolverEmail ? ` (${resolverEmail})` : ""
              }.</p>
                  <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; margin: 15px 0;">
                    <p><strong>Issue:</strong> ${updatedIssue.subject}</p>
                    <p><strong>Category:</strong> ${updatedIssue.category}</p>
                    <p><strong>Resolution:</strong> ${
                      updatedIssue.reslvedComment || "No comment provided"
                    }</p>
                  </div>
                  <p>Please don't forget to leave a rating for the resolution.</p>
                  <p>Thank you,<br>Issue Management System</p>
                </div>
              `;
            }

            // Send the email
            await transporter.sendMail({
              from: '"Issue Management System" <wjr46269@gmail.com>',
              to: submitter.mail,
              subject: `Your Issue Has Been Resolved: ${updatedIssue.subject}`,
              html: emailContent,
            });
          }
        }
      }
    } catch (emailError) {
      // Log email errors but don't fail the request
      console.error("Error sending notification email:", emailError);
    }

    return NextResponse.json(updatedIssue);
  } catch (error) {
    console.error("Error resolving issue:", error);
    if (error instanceof mongoose.Error.ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
