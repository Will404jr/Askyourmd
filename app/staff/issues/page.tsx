"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Calendar,
  Check,
  Menu,
  Pencil,
  Trash2,
} from "lucide-react";

interface Issue {
  _id: string;
  subject: string;
  category: string;
  content: string;
  status: string;
  submittedBy: string;
  assignedTo: string | null;
  approved: boolean;
  createdAt: string;
}

interface SessionData {
  id: string;
  isLoggedIn: boolean;
  username: string;
  email: string;
  givenName: string;
  surname: string;
  userPrincipalName: string;
  personnelType: string;
}

const IssueTracker = () => {
  const [step, setStep] = useState(1);
  const [showRecentIssues, setShowRecentIssues] = useState(false);
  const [session, setSession] = useState<SessionData | null>(null);
  const [userIssues, setUserIssues] = useState<Issue[]>([]);
  const [editingIssueId, setEditingIssueId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    subject: "",
    content: "",
    category: "",
    status: "Open",
    submittedBy: "",
    isUrgent: false,
    isAnonymous: false,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const sessionRes = await fetch("/api/session");
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json();
          setSession(sessionData);
        }

        const issuesRes = await fetch("/api/issues");
        if (issuesRes.ok) {
          const issues = await issuesRes.json();
          const userIssues = issues.filter(
            (issue: Issue) => issue.submittedBy === session?.id
          );
          setUserIssues(userIssues);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      }
    };

    fetchData();
  }, [session?.id]);

  const handleSubmit = async () => {
    try {
      const issueData = {
        subject: formData.subject,
        category: formData.category,
        content: formData.content,
        status: formData.isUrgent ? "Urgent" : "Open",
        submittedBy: formData.isAnonymous ? "anonymous" : session?.id,
      };

      let response;

      if (editingIssueId) {
        // Update existing issue
        response = await fetch(`/api/issues/${editingIssueId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(issueData),
        });
      } else {
        // Create new issue
        response = await fetch("/api/issues", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(issueData),
        });
      }

      if (response.ok) {
        // Refresh the issues list
        const issuesRes = await fetch("/api/issues");
        if (issuesRes.ok) {
          const issues = await issuesRes.json();
          const userIssues = issues.filter(
            (issue: Issue) => issue.submittedBy === session?.id
          );
          setUserIssues(userIssues);
        }

        // Reset form and editing state
        setFormData({
          subject: "",
          content: "",
          category: "",
          status: "Open",
          submittedBy: "",
          isUrgent: false,
          isAnonymous: false,
        });
        setEditingIssueId(null); // Reset editing state
        setStep(1);
      }
    } catch (error) {
      console.error("Failed to submit issue:", error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/issues/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setUserIssues(userIssues.filter((issue) => issue._id !== id));
      }
    } catch (error) {
      console.error("Failed to delete issue:", error);
    }
  };

  const handleEdit = async (issue: Issue) => {
    setEditingIssueId(issue._id); // Set the ID of the issue being edited
    setFormData({
      subject: issue.subject,
      content: issue.content,
      category: issue.category,
      status: issue.status,
      submittedBy: issue.submittedBy,
      isUrgent: issue.status === "Urgent",
      isAnonymous: issue.submittedBy === "anonymous",
    });
    setStep(1);
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) =>
                  setFormData({ ...formData, subject: e.target.value })
                }
                className="mt-1"
                placeholder="Enter issue subject"
              />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) =>
                  setFormData({ ...formData, category: value })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Personal">Personal</SelectItem>
                  <SelectItem value="Official">Official</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <Label>Content</Label>
            <div className="border rounded-md p-4 min-h-[200px] bg-white">
              <textarea
                className="w-full h-full min-h-[180px] resize-none border-none focus:outline-none"
                value={formData.content}
                onChange={(e) =>
                  setFormData({ ...formData, content: e.target.value })
                }
                placeholder="Describe your issue..."
              />
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Anonymous Submission</Label>
                <div className="text-sm text-gray-500">
                  Hide your identity from other users
                </div>
              </div>
              <Switch
                checked={formData.isAnonymous}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isAnonymous: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Mark as Urgent</Label>
                <div className="text-sm text-gray-500">
                  Prioritize this issue
                </div>
              </div>
              <Switch
                checked={formData.isUrgent}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isUrgent: checked })
                }
              />
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Review Your Submission</h3>
            <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-gray-500">Subject</Label>
                  <p className="font-medium">
                    {formData.subject || "(Not specified)"}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Category</Label>
                  <p className="font-medium">
                    {formData.category || "(Not specified)"}
                  </p>
                </div>
                {/* <div>
                  <Label className="text-sm text-gray-500">Due Date</Label>
                  <p className="font-medium">
                    {formData.dueDate || "(Not specified)"}
                  </p>
                </div> */}
                <div>
                  <Label className="text-sm text-gray-500">Status</Label>
                  <p className="font-medium">
                    {formData.isUrgent ? "Urgent" : "Open"}
                  </p>
                </div>
              </div>
              <div>
                <Label className="text-sm text-gray-500">Content</Label>
                <div className="mt-1 p-3 bg-white rounded border">
                  <p className="whitespace-pre-wrap">
                    {formData.content || "(No content provided)"}
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <Check
                    className={`w-4 h-4 ${
                      formData.isAnonymous ? "text-blue-600" : "text-gray-400"
                    }`}
                  />
                  <span className="text-sm">Anonymous Submission</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle
                    className={`w-4 h-4 ${
                      formData.isUrgent ? "text-red-500" : "text-gray-400"
                    }`}
                  />
                  <span className="text-sm">Urgent Status</span>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="p-4 sm:p-6 max-w-7xl mx-auto bg-white rounded-lg shadow-lg">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <Card className="bg-white shadow-lg">
              <div className="w-full bg-gradient-to-r from-blue-600 to-green-400 h-1 absolute top-0 left-0 right-0" />
              <CardHeader>
                <div className="flex justify-between items-center mb-4">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-bold tracking-tight">
                        {editingIssueId ? "Edit Issue" : "New Issue"}
                      </h2>
                    </div>
                    <p className="text-gray-500">Step {step} of 4</p>
                  </div>
                  <div className="flex gap-2">
                    {step > 1 && (
                      <Button
                        onClick={() => setStep(step - 1)}
                        variant="outline"
                        size="sm"
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                      </Button>
                    )}
                    {step < 4 ? (
                      <Button
                        onClick={() => setStep(step + 1)}
                        className="bg-blue-600 hover:bg-blue-700"
                        size="sm"
                      >
                        Next <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    ) : (
                      <Button
                        onClick={handleSubmit}
                        className="bg-green-600 hover:bg-green-700"
                        size="sm"
                      >
                        {editingIssueId ? "Save Changes" : "Confirm & Submit"}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>{renderStep()}</CardContent>
            </Card>
          </div>

          <div
            className={`w-full lg:w-80 ${
              showRecentIssues ? "block" : "hidden lg:block"
            }`}
          >
            <h3 className="text-lg font-semibold mb-4">Recent Issues</h3>
            <div className="space-y-3">
              {userIssues.map((issue) => (
                <Card key={issue._id} className="bg-white">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium truncate flex-1">
                        {issue.subject}
                      </h4>
                      {issue.status === "Urgent" && (
                        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 ml-2" />
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">
                        {issue.category}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(issue)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(issue._id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              Details
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>{issue.subject}</DialogTitle>
                            </DialogHeader>
                            <div className="mt-4">
                              <p className="text-gray-700">{issue.content}</p>
                              <div className="mt-4 text-sm text-gray-500">
                                <p>Status: {issue.status}</p>
                                <p>Category: {issue.category}</p>
                                <p>Submitted By: {issue.submittedBy}</p>
                                <p>
                                  Created:{" "}
                                  {new Date(
                                    issue.createdAt
                                  ).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {userIssues.length === 0 && (
                <div className="text-center p-4 text-gray-500">
                  No issues found
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default IssueTracker;
