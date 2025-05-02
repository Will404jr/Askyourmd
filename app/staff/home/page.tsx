"use client";

import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MoreVertical, CheckSquare, Info, Star } from "lucide-react";
import MoodTracker from "@/components/rating";

// Define Azure AD user interface
interface AzureADUser {
  id: string;
  displayName: string;
  givenName?: string;
  surname?: string;
  mail?: string;
  userPrincipalName: string;
  jobTitle?: string;
  department?: string;
}

interface Issue {
  _id: string;
  subject: string;
  category: string;
  status: string;
  assignedTo: string; // This is now a user ID
  submittedBy: string; // This is now a user ID
  content: string;
  approved: boolean;
  reslvedComment: string | null;
  rating: string | null;
  createdAt: string;
}

export default function IssuesTable() {
  const [issues, setIssues] = React.useState<Issue[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [selectedIssue, setSelectedIssue] = React.useState<Issue | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isResolveDialogOpen, setIsResolveDialogOpen] = React.useState(false);
  const [resolveComment, setResolveComment] = React.useState("");
  const [session, setSession] = React.useState<any>(null);
  const [users, setUsers] = React.useState<AzureADUser[]>([]);
  const [userMap, setUserMap] = React.useState<Record<string, AzureADUser>>({});
  const itemsPerPage = 10;
  const [isRatingDialogOpen, setIsRatingDialogOpen] = React.useState(false);
  // Add loading state at the top of the component
  const [isLoading, setIsLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);

  // Fetch issues, session, and users
  React.useEffect(() => {
    // Modify the fetchData function in the useEffect to handle loading states
    const fetchData = async () => {
      try {
        // Only set loading state on initial load, not during polling
        if (!isPolling) {
          setIsLoading(true);
        }

        const [issuesResponse, sessionResponse, usersResponse] =
          await Promise.all([
            fetch("/api/issues"),
            fetch("/api/session"),
            fetch("/api/users"),
          ]);

        if (!issuesResponse.ok || !sessionResponse.ok || !usersResponse.ok) {
          throw new Error("Failed to fetch data");
        }

        const issuesData = await issuesResponse.json();
        const sessionData = await sessionResponse.json();
        const usersData = await usersResponse.json();

        // Only show approved issues
        setIssues(issuesData.filter((issue: Issue) => issue.approved));
        setSession(sessionData);

        // Store users and create a map for quick lookup
        const usersList = usersData.users || [];
        setUsers(usersList);

        const userMapping: Record<string, AzureADUser> = {};
        usersList.forEach((user: AzureADUser) => {
          userMapping[user.id] = user;
        });
        setUserMap(userMapping);

        console.log("Fetched users:", usersList.length);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        // Only update loading state for initial load
        if (!isPolling) {
          setIsLoading(false);
        }
      }
    };

    // Update the polling setup to properly set isPolling
    // Initial data fetch
    fetchData();

    // Set up polling every 5 seconds
    const intervalId = setInterval(() => {
      setIsPolling(true); // Set polling to true before fetch
      fetchData();
    }, 5000);

    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  // Get user display name from ID
  const getUserDisplayName = (userId: string): string => {
    if (!userId) return "Unassigned";
    const user = userMap[userId];
    return user ? user.displayName : userId;
  };

  // Filter issues based on search query and status
  const filteredIssues = issues
    .filter((issue) => {
      const matchesSearch = issue.subject
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === "all" ||
        issue.status.toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      // Sort Urgent issues first
      if (a.status === "Urgent" && b.status !== "Urgent") return -1;
      if (a.status !== "Urgent" && b.status === "Urgent") return 1;
      // For non-urgent issues, sort by creation date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  // Calculate pagination
  const totalPages = Math.ceil(filteredIssues.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedIssues = filteredIssues.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  // Format date for display
  const formatDate = (dateString: string | number | Date) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Handle opening the resolve dialog
  const openResolveDialog = (issue: Issue) => {
    setSelectedIssue(issue);
    setResolveComment("");
    setIsResolveDialogOpen(true);
  };

  // Handle resolving an issue
  const handleResolve = async () => {
    if (!selectedIssue) return;

    try {
      const response = await fetch(`/api/issues/${selectedIssue._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "Closed",
          reslvedComment: resolveComment,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to resolve issue");
      }

      const updatedIssue = await response.json();
      setIssues(
        issues.map((issue) =>
          issue._id === selectedIssue._id ? updatedIssue : issue
        )
      );

      setIsResolveDialogOpen(false);
    } catch (error) {
      console.error("Error resolving issue:", error);
    }
  };

  const handleRatingSubmit = async (rating: string) => {
    if (!selectedIssue) return;

    try {
      const response = await fetch(`/api/issues/${selectedIssue._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rating: rating.charAt(0).toUpperCase() + rating.slice(1), // Capitalize first letter
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit rating");
      }

      const updatedIssue = await response.json();
      setIssues(
        issues.map((issue) =>
          issue._id === selectedIssue._id ? updatedIssue : issue
        )
      );

      setIsRatingDialogOpen(false);
    } catch (error) {
      console.error("Error submitting rating:", error);
    }
  };

  return (
    <main className="container mx-auto px-4 py-8 w-[90%]">
      <div className="w-full space-y-4 bg-white p-6 rounded-lg shadow-lg">
        <div className="w-full bg-gradient-to-r from-blue-600 to-green-400 h-1 absolute top-0 left-0 right-0" />
        <div className="flex items-center justify-between">
          <Input
            placeholder="Search issues..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Open">Open</SelectItem>
              <SelectItem value="Closed">Closed</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Overdue">Overdue</SelectItem>
              <SelectItem value="Urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned to</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && !isPolling ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-8 text-gray-500"
                >
                  Loading issues...
                </TableCell>
              </TableRow>
            ) : paginatedIssues.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-8 text-gray-500"
                >
                  No issues found.
                </TableCell>
              </TableRow>
            ) : (
              paginatedIssues.map((issue) => (
                <TableRow key={issue._id}>
                  <TableCell className="font-medium">{issue.subject}</TableCell>
                  <TableCell>{issue.category}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
                        {
                          "bg-yellow-100 text-yellow-700":
                            issue.status === "Pending",
                          "bg-red-100 text-red-700":
                            issue.status === "Overdue" ||
                            issue.status === "Urgent",
                          "bg-green-100 text-green-700":
                            issue.status === "Closed",
                          "bg-blue-100 text-blue-700": issue.status === "Open",
                          "animate-pulse": issue.status === "Urgent",
                        }
                      )}
                    >
                      {issue.status}
                    </span>
                  </TableCell>
                  <TableCell>{getUserDisplayName(issue.assignedTo)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger>
                        <MoreVertical className="h-5 w-5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedIssue(issue);
                            setIsDialogOpen(true);
                          }}
                        >
                          <Info className="mr-2 h-4 w-4" />
                          Details
                        </DropdownMenuItem>
                        {session?.id === issue.assignedTo &&
                          issue.status !== "Closed" && (
                            <DropdownMenuItem
                              onClick={() => openResolveDialog(issue)}
                            >
                              <CheckSquare className="mr-2 h-4 w-4" />
                              Resolve
                            </DropdownMenuItem>
                          )}
                        {session?.id === issue.submittedBy &&
                          issue.status === "Closed" &&
                          !issue.rating && (
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedIssue(issue);
                                setIsRatingDialogOpen(true);
                              }}
                            >
                              <Star className="mr-2 h-4 w-4" />
                              Rate
                            </DropdownMenuItem>
                          )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Issue Details Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold pb-2 border-b">
                {selectedIssue?.subject}
              </DialogTitle>
            </DialogHeader>
            {selectedIssue && (
              <div className="space-y-6 pt-2">
                <div className="flex items-center justify-between gap-4">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium",
                      {
                        "bg-yellow-100 text-yellow-700":
                          selectedIssue.status === "Pending",
                        "bg-red-100 text-red-700":
                          selectedIssue.status === "Overdue" ||
                          selectedIssue.status === "Urgent",
                        "bg-green-100 text-green-700":
                          selectedIssue.status === "Closed",
                        "bg-blue-100 text-blue-700":
                          selectedIssue.status === "Open",
                      }
                    )}
                  >
                    {selectedIssue.status}
                  </span>
                  <p className="text-sm text-gray-500">
                    Created on {formatDate(selectedIssue.createdAt)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-6 bg-gray-50 p-4 rounded-lg">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">
                      Category
                    </h3>
                    <p className="font-medium">{selectedIssue.category}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">
                      Submitted By
                    </h3>
                    <p className="font-medium">
                      {getUserDisplayName(selectedIssue.submittedBy)}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">
                      Assigned To
                    </h3>
                    <p className="font-medium">
                      {getUserDisplayName(selectedIssue.assignedTo)}
                    </p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">
                    Description
                  </h3>
                  <div className="bg-white p-4 border rounded-lg whitespace-pre-wrap">
                    {selectedIssue.content}
                  </div>
                </div>

                {selectedIssue.reslvedComment && (
                  <div className="border-t pt-4">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">
                      Resolution Comment
                    </h3>
                    <div className="bg-green-50 p-4 border-l-4 border-green-400 rounded-r-lg whitespace-pre-wrap">
                      {selectedIssue.reslvedComment}
                    </div>
                  </div>
                )}

                {selectedIssue.rating && (
                  <div className="border-t pt-4">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">
                      Feedback Rating
                    </h3>
                    <div className="flex items-center">
                      <Star
                        className={cn(
                          "h-6 w-6 mr-2",
                          selectedIssue.rating === "Good"
                            ? "fill-yellow-400 text-yellow-400"
                            : selectedIssue.rating === "Fair"
                            ? "fill-blue-400 text-blue-400"
                            : "fill-red-400 text-red-400"
                        )}
                      />
                      <span className="font-medium">
                        {selectedIssue.rating}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Resolve Issue Dialog */}
        <Dialog
          open={isResolveDialogOpen}
          onOpenChange={setIsResolveDialogOpen}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Resolve Issue</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p>Add a comment about how this issue was resolved:</p>
              <Textarea
                placeholder="Resolution details..."
                value={resolveComment}
                onChange={(e) => setResolveComment(e.target.value)}
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsResolveDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button className="bg-[#1d4ed8]" onClick={handleResolve}>
                Resolve Issue
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Rating Dialog */}
        <Dialog open={isRatingDialogOpen} onOpenChange={setIsRatingDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Rate Resolution</DialogTitle>
            </DialogHeader>
            <MoodTracker onRatingSelect={handleRatingSubmit} />
          </DialogContent>
        </Dialog>

        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className={cn(
                  currentPage === 1 && "pointer-events-none opacity-50"
                )}
              />
            </PaginationItem>
            {[...Array(totalPages)].map((_, i) => (
              <PaginationItem key={i + 1}>
                <PaginationLink
                  onClick={() => setCurrentPage(i + 1)}
                  isActive={currentPage === i + 1}
                >
                  {i + 1}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                className={cn(
                  currentPage === totalPages && "pointer-events-none opacity-50"
                )}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </main>
  );
}
