import { type NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { Issue } from "@/lib/models/issues"; // Adjust this import path as needed
import dbConnect from "@/lib/db";
import nodemailer from "nodemailer";

// Create a transporter
const transporter = nodemailer.createTransport({
  host: "192.168.192.160",
  port: 25,
  secure: false,
  tls: {
    // Do not fail on invalid certificates
    rejectUnauthorized: false,
  },
});

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await context.params;

  try {
    await dbConnect();
    const { assignedTo, status } = await request.json();

    // Get the issue before updating to access the submittedBy field
    const issue = await Issue.findById(id);
    if (!issue) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 });
    }

    const updatedIssue = await Issue.findByIdAndUpdate(
      id,
      { assignedTo, status },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedIssue) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 });
    }

    // Send email notifications
    try {
      // Fetch user details for the assignee
      const assigneeResponse = await fetch(
        `${
          process.env.BASE_URL || "https://askyourmd.nssfug.org"
        }/api/users/${assignedTo}`
      );

      if (assigneeResponse.ok) {
        const assigneeData = await assigneeResponse.json();
        const assignee = assigneeData.user;

        if (assignee && assignee.mail) {
          // Email to assignee
          await transporter.sendMail({
            from: "<askyourmd@nssfug.org>",
            to: assignee.mail,
            subject: `New Issue Assignment: ${updatedIssue.subject}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                <h2 style="color: #1d4ed8;">New Issue Assigned to You</h2>
                <p>Hello ${assignee.displayName},</p>
                <p>An issue has been assigned to you in the Issue Management System.</p>
                <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; margin: 15px 0;">
                  <p><strong>Issue:</strong> ${updatedIssue.subject}</p>
                  <p><strong>Category:</strong> ${updatedIssue.category}</p>
                  <p><strong>Status:</strong> ${updatedIssue.status}</p>
                </div>
                <p>Please log in to the system to view the details and take appropriate action.</p>
                <p>Thank you,<br>Issue Management System</p>
              </div>
            `,
          });
        }

        // Only send email to submitter if they're not anonymous
        if (
          issue.submittedBy !== "anonymous" &&
          issue.submittedBy !== "Anonymous"
        ) {
          // Fetch submitter details
          const submitterResponse = await fetch(
            `${
              process.env.BASE_URL || "https://askyourmd.nssfug.org"
            }/api/users/${issue.submittedBy}`
          );

          if (submitterResponse.ok) {
            const submitterData = await submitterResponse.json();
            const submitter = submitterData.user;

            if (submitter && submitter.mail) {
              // Email to submitter
              await transporter.sendMail({
                from: '"Issue Management System" <issues@example.com>',
                to: submitter.mail,
                subject: `Your Issue Has Been Assigned: ${updatedIssue.subject}`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                    <h2 style="color: #1d4ed8;">Issue Assignment Update</h2>
                    <p>Hello ${submitter.displayName},</p>
                    <p>Your submitted issue has been assigned to a staff member.</p>
                    <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; margin: 15px 0;">
                      <p><strong>Issue:</strong> ${updatedIssue.subject}</p>
                      <p><strong>Category:</strong> ${updatedIssue.category}</p>
                      <p><strong>Status:</strong> ${updatedIssue.status}</p>
                      <p><strong>Assigned To:</strong> ${assignee.displayName} (${assignee.mail})</p>
                    </div>
                    <p>The assigned staff member will work on resolving your issue.</p>
                    <p>Thank you,<br>Issue Management System</p>
                  </div>
                `,
              });
            }
          }
        }
      }
    } catch (emailError) {
      // Log email errors but don't fail the request
      console.error("Error sending notification emails:", emailError);
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
