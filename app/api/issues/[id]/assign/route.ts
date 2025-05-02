import { type NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { Issue } from "@/lib/models/issues";
import dbConnect from "@/lib/db";
import nodemailer from "nodemailer";

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

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await context.params;

  try {
    await dbConnect();

    // Get data from request body including user data
    const { assignedTo, status, assigneeData, submitterData } =
      await request.json();

    // Get the issue before updating
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
      // Send email to assignee if we have their data
      if (assigneeData && assigneeData.mail) {
        const emailContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Issue Assignment</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 0; padding: 0; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #1d4ed8; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
              .header h1 { color: white; margin: 0; font-size: 24px; }
              .content { background-color: #ffffff; padding: 20px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 5px 5px; }
              .issue-details { background-color: #f9fafb; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #1d4ed8; }
              .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
              .button { display: inline-block; background-color: #1d4ed8; color: white; text-decoration: none; padding: 10px 20px; border-radius: 5px; margin-top: 15px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>New Issue Assigned to You</h1>
              </div>
              <div class="content">
                <p>Hello ${assigneeData.displayName},</p>
                <p>An issue has been assigned to you in the Issue Management System.</p>
                <div class="issue-details">
                  <p><strong>Issue:</strong> ${updatedIssue.subject}</p>
                  <p><strong>Category:</strong> ${updatedIssue.category}</p>
                  <p><strong>Status:</strong> ${updatedIssue.status}</p>
                </div>
                <p>Please log in to the system to view the details and take appropriate action.</p>
                <p>Thank you,</p>
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
          to: assigneeData.mail,
          subject: `New Issue Assignment: ${updatedIssue.subject}`,
          html: emailContent,
        };

        await transporter.sendMail(mailOptions);
      }

      // Send email to submitter if we have their data and they're not anonymous
      if (
        submitterData &&
        submitterData.mail &&
        issue.submittedBy !== "anonymous" &&
        issue.submittedBy !== "Anonymous"
      ) {
        const emailContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Issue Assignment Update</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 0; padding: 0; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #1d4ed8; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
              .header h1 { color: white; margin: 0; font-size: 24px; }
              .content { background-color: #ffffff; padding: 20px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 5px 5px; }
              .issue-details { background-color: #f9fafb; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #1d4ed8; }
              .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
              .button { display: inline-block; background-color: #1d4ed8; color: white; text-decoration: none; padding: 10px 20px; border-radius: 5px; margin-top: 15px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Issue Assignment Update</h1>
              </div>
              <div class="content">
                <p>Hello ${submitterData.displayName},</p>
                <p>Your submitted issue has been assigned to a staff member.</p>
                <div class="issue-details">
                  <p><strong>Issue:</strong> ${updatedIssue.subject}</p>
                  <p><strong>Category:</strong> ${updatedIssue.category}</p>
                  <p><strong>Status:</strong> ${updatedIssue.status}</p>
                  <p><strong>Assigned To:</strong> ${
                    assigneeData?.displayName || "Staff Member"
                  } ${assigneeData?.mail ? `(${assigneeData.mail})` : ""}</p>
                </div>
                <p>The assigned staff member will work on resolving your issue.</p>
                <p>Thank you,</p>
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
          subject: `Your Issue Has Been Assigned: ${updatedIssue.subject}`,
          html: emailContent,
        };

        await transporter.sendMail(mailOptions);
      }
    } catch (emailError) {
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
