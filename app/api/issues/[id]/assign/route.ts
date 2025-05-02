import { type NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { Issue } from "@/lib/models/issues"; // Adjust this import path as needed
import dbConnect from "@/lib/db";
import nodemailer from "nodemailer";

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

// Create a custom fetch function that ignores SSL certificate errors
const fetchWithoutCertValidation = async (
  url: string,
  options?: RequestInit
) => {
  // In Node.js environment, we need to configure the fetch to ignore SSL errors
  const { Agent } = await import("https");

  const httpsAgent = new Agent({
    rejectUnauthorized: false, // Ignore SSL certificate errors
  });

  return fetch(url, {
    ...options,
    // @ts-ignore - The agent property exists but might not be in the types
    agent: httpsAgent,
  });
};

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

    const { assignedTo, status } = await request.json();
    console.log(
      `📋 Assignment details - assignedTo: ${assignedTo}, status: ${status}`
    );

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
      // Fetch user details for the assignee
      const baseUrl = process.env.BASE_URL || "https://askyourmd.nssfug.org";
      const assigneeUrl = `${baseUrl}/api/users/${assignedTo}`;
      console.log(`🔍 Fetching assignee details from: ${assigneeUrl}`);

      const assigneeResponse = await fetchWithoutCertValidation(assigneeUrl);
      console.log(
        `📊 Assignee API response status: ${assigneeResponse.status}`
      );

      if (assigneeResponse.ok) {
        const assigneeData = await assigneeResponse.json();
        const assignee = assigneeData.user;
        console.log(
          `✅ Assignee data retrieved: ${JSON.stringify(
            assignee
              ? {
                  id: assignee.id,
                  displayName: assignee.displayName,
                  mail: assignee.mail,
                }
              : { error: "No user data" }
          )}`
        );

        if (assignee && assignee.mail) {
          // Email to assignee
          console.log(`📧 Preparing email to assignee: ${assignee.mail}`);

          const emailContent = `
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
          `;

          const mailOptions = {
            from: '"Issue Management System" <askyourmd@nssfug.org>',
            to: assignee.mail,
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
          } catch (sendError) {
            console.error(
              `❌ Failed to send email to assignee: ${assignee.mail}`
            );
            console.error(`❌ Error details:`, sendError);
            if (sendError instanceof Error) {
              console.error(`❌ Stack trace:`, sendError.stack);
            }
          }
        } else {
          console.warn(
            `⚠️ No email address found for assignee with ID: ${assignedTo}`
          );
        }

        // Only send email to submitter if they're not anonymous
        if (
          issue.submittedBy !== "anonymous" &&
          issue.submittedBy !== "Anonymous"
        ) {
          // Fetch submitter details
          const submitterUrl = `${baseUrl}/api/users/${issue.submittedBy}`;
          console.log(`🔍 Fetching submitter details from: ${submitterUrl}`);

          const submitterResponse = await fetchWithoutCertValidation(
            submitterUrl
          );
          console.log(
            `📊 Submitter API response status: ${submitterResponse.status}`
          );

          if (submitterResponse.ok) {
            const submitterData = await submitterResponse.json();
            const submitter = submitterData.user;
            console.log(
              `✅ Submitter data retrieved: ${JSON.stringify(
                submitter
                  ? {
                      id: submitter.id,
                      displayName: submitter.displayName,
                      mail: submitter.mail,
                    }
                  : { error: "No user data" }
              )}`
            );

            if (submitter && submitter.mail) {
              // Email to submitter
              console.log(`📧 Preparing email to submitter: ${submitter.mail}`);

              const emailContent = `
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
              `;

              const mailOptions = {
                from: '"Issue Management System" <askyourmd@nssfug.org>',
                to: submitter.mail,
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
                console.log(
                  `✅ Email sent to submitter: ${JSON.stringify(info)}`
                );
                console.log(`📧 Message ID: ${info.messageId}`);
                console.log(`📧 Response: ${info.response}`);
              } catch (sendError) {
                console.error(
                  `❌ Failed to send email to submitter: ${submitter.mail}`
                );
                console.error(`❌ Error details:`, sendError);
                if (sendError instanceof Error) {
                  console.error(`❌ Stack trace:`, sendError.stack);
                }
              }
            } else {
              console.warn(
                `⚠️ No email address found for submitter with ID: ${issue.submittedBy}`
              );
            }
          } else {
            console.error(
              `❌ Failed to fetch submitter data: ${submitterResponse.status}`
            );
            const errorText = await submitterResponse.text();
            console.error(`❌ Error response: ${errorText}`);
          }
        } else {
          console.log(
            `ℹ️ Skipping submitter email as the issue was submitted anonymously`
          );
        }
      } else {
        console.error(
          `❌ Failed to fetch assignee data: ${assigneeResponse.status}`
        );
        const errorText = await assigneeResponse.text();
        console.error(`❌ Error response: ${errorText}`);
      }
    } catch (emailError) {
      // Log email errors but don't fail the request
      console.error("❌ Error sending notification emails:", emailError);
      if (emailError instanceof Error) {
        console.error("❌ Error stack:", emailError.stack);
      }
      console.error("❌ Error details:", JSON.stringify(emailError, null, 2));
    }

    console.log(`✅ Assignment process completed for issue: ${id}`);
    return NextResponse.json(updatedIssue);
  } catch (error) {
    console.error("❌ Error updating issue:", error);
    if (error instanceof Error) {
      console.error("❌ Error stack:", error.stack);
    }

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
