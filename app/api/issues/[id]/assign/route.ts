import { type NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { Issue } from "@/lib/models/issues"; // Adjust this import path as needed
import dbConnect from "@/lib/db";
import nodemailer from "nodemailer";

// Define interfaces for user data
interface UserData {
  id: string;
  displayName: string;
  mail: string;
}

// Create a transporter with debugging enabled
const transporter = nodemailer.createTransport({
  host: "192.168.192.160",
  port: 25,
  secure: false,
  debug: true, // Enable debug mode
  logger: true, // Enable logging
  tls: {
    // Do not fail on invalid certificates
    rejectUnauthorized: false,
  },
});

// Test SMTP connection function
async function testSmtpConnection() {
  try {
    console.log("🔍 Testing SMTP connection to 192.168.192.160:25...");
    await transporter.verify();
    console.log("✅ SMTP connection successful!");
    return true;
  } catch (error) {
    console.error("❌ SMTP connection failed:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));
    return false;
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await context.params;
  console.log(`📝 Processing assignment for issue ID: ${id}`);

  try {
    await dbConnect();
    console.log("✅ Database connection established");

    // Get data from request body including user data
    const { assignedTo, status, assigneeData, submitterData } =
      await request.json();
    console.log(
      `📋 Assignment details - assignedTo: ${assignedTo}, status: ${status}`
    );
    console.log(`📋 Assignee data:`, assigneeData);
    console.log(`📋 Submitter data:`, submitterData);

    // Get the issue before updating to access the submittedBy field
    const issue = await Issue.findById(id);
    if (!issue) {
      console.error(`❌ Issue not found with ID: ${id}`);
      return NextResponse.json({ error: "Issue not found" }, { status: 404 });
    }
    console.log(`✅ Found issue: ${issue.subject}`);

    const updatedIssue = await Issue.findByIdAndUpdate(
      id,
      { assignedTo, status },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedIssue) {
      console.error(`❌ Failed to update issue with ID: ${id}`);
      return NextResponse.json({ error: "Issue not found" }, { status: 404 });
    }
    console.log(`✅ Issue updated successfully: ${updatedIssue._id}`);

    // Test SMTP connection before attempting to send emails
    const smtpConnectionSuccessful = await testSmtpConnection();
    if (!smtpConnectionSuccessful) {
      console.error("❌ Skipping email sending due to SMTP connection failure");
    } else {
      console.log("🚀 Proceeding with email notifications");
    }

    // Send email notifications
    try {
      // Send email to assignee if we have their data
      if (assigneeData && assigneeData.mail) {
        console.log(`📧 Preparing email to assignee: ${assigneeData.mail}`);

        const emailContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
            <h2 style="color: #1d4ed8;">New Issue Assigned to You</h2>
            <p>Hello ${assigneeData.displayName},</p>
            <p>An issue has been assigned to you in the Issue Management System.</p>
            <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <p><strong>Issue:</strong> ${updatedIssue.subject}</p>
              <p><strong>Category:</strong> ${updatedIssue.category}</p>
              <p><strong>Status:</strong> ${updatedIssue.status}</p>
            </div>
            <p>Please log in to the system to view the details and take appropriate action.</p>
            <p>Thank you,<br>Issue Management System</p>
          </div>
        `;

        const mailOptions = {
          from: '"Issue Management System" <askyourmd@nssfug.org>',
          to: assigneeData.mail,
          subject: `New Issue Assignment: ${updatedIssue.subject}`,
          html: emailContent,
        };

        console.log(
          `📧 Sending email with options: ${JSON.stringify({
            from: mailOptions.from,
            to: mailOptions.to,
            subject: mailOptions.subject,
          })}`
        );

        try {
          const info = await transporter.sendMail(mailOptions);
          console.log(`✅ Email sent to assignee: ${JSON.stringify(info)}`);
          console.log(`📧 Message ID: ${info.messageId}`);
          console.log(`📧 Response: ${info.response}`);
        } catch (error) {
          const sendError = error as Error;
          console.error(
            `❌ Failed to send email to assignee: ${assigneeData.mail}`
          );
          console.error(`❌ Error details:`, sendError);
          console.error(`❌ Stack trace:`, sendError.stack);
        }
      } else {
        console.warn(
          `⚠️ No email address found for assignee with ID: ${assignedTo}`
        );
      }

      // Send email to submitter if we have their data and they're not anonymous
      if (
        submitterData &&
        submitterData.mail &&
        issue.submittedBy !== "anonymous" &&
        issue.submittedBy !== "Anonymous"
      ) {
        console.log(`📧 Preparing email to submitter: ${submitterData.mail}`);

        const emailContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
            <h2 style="color: #1d4ed8;">Issue Assignment Update</h2>
            <p>Hello ${submitterData.displayName},</p>
            <p>Your submitted issue has been assigned to a staff member.</p>
            <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <p><strong>Issue:</strong> ${updatedIssue.subject}</p>
              <p><strong>Category:</strong> ${updatedIssue.category}</p>
              <p><strong>Status:</strong> ${updatedIssue.status}</p>
              <p><strong>Assigned To:</strong> ${
                assigneeData?.displayName || "Staff Member"
              } ${assigneeData?.mail ? `(${assigneeData.mail})` : ""}</p>
            </div>
            <p>The assigned staff member will work on resolving your issue.</p>
            <p>Thank you,<br>Issue Management System</p>
          </div>
        `;

        const mailOptions = {
          from: '"Issue Management System" <askyourmd@nssfug.org>',
          to: submitterData.mail,
          subject: `Your Issue Has Been Assigned: ${updatedIssue.subject}`,
          html: emailContent,
        };

        console.log(
          `📧 Sending email with options: ${JSON.stringify({
            from: mailOptions.from,
            to: mailOptions.to,
            subject: mailOptions.subject,
          })}`
        );

        try {
          const info = await transporter.sendMail(mailOptions);
          console.log(`✅ Email sent to submitter: ${JSON.stringify(info)}`);
          console.log(`📧 Message ID: ${info.messageId}`);
          console.log(`📧 Response: ${info.response}`);
        } catch (error) {
          const sendError = error as Error;
          console.error(
            `❌ Failed to send email to submitter: ${submitterData.mail}`
          );
          console.error(`❌ Error details:`, sendError);
          console.error(`❌ Stack trace:`, sendError.stack);
        }
      } else {
        console.log(
          `ℹ️ Skipping submitter email as the issue was submitted anonymously or no email available`
        );
      }
    } catch (emailError) {
      // Log email errors but don't fail the request
      const error = emailError as Error;
      console.error("❌ Error sending notification emails:", error);
      console.error("❌ Error stack:", error.stack);
      console.error("❌ Error details:", JSON.stringify(error, null, 2));
    }

    console.log(`✅ Assignment process completed for issue: ${id}`);
    return NextResponse.json(updatedIssue);
  } catch (error) {
    const err = error as Error;
    console.error("❌ Error updating issue:", err);
    console.error("❌ Error stack:", err.stack);

    if (error instanceof mongoose.Error.ValidationError) {
      console.error(
        "❌ Validation error:",
        JSON.stringify(error.errors, null, 2)
      );
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
