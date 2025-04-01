"use client";

import React from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandInput, CommandList, CommandItem } from "cmdk";
import { MoreVertical, UserPlus, CheckCircle, Info, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { users } from "@/lib/user";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";

interface User {
  id: string;
  username: string;
  email: string;
  personnelType: string;
}

interface Issue {
  _id: string;
  subject: string;
  category: string;
  status: string;
  assignedTo: string | null;
  submittedBy: string;
  content: string;
  approved: boolean;
  reslvedComment: string | null;
  createdAt: string;
  rating: string | null;
}

export default function EnhancedIssuesTable() {
  const [issues, setIssues] = React.useState<Issue[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [approvedFilter, setApprovedFilter] = React.useState("all");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [selectedIssue, setSelectedIssue] = React.useState<Issue | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = React.useState(false);
  const [userSearchQuery, setUserSearchQuery] = React.useState("");
  const itemsPerPage = 10;
  const [isResolveDialogOpen, setIsResolveDialogOpen] = React.useState(false);
  const [resolveComment, setResolveComment] = React.useState("");
  const [session, setSession] = React.useState<any>(null);

  // Fetch issues and session
  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const [issuesResponse, sessionResponse] = await Promise.all([
          fetch("/api/issues"),
          fetch("/api/session"),
        ]);
        if (!issuesResponse.ok || !sessionResponse.ok)
          throw new Error("Failed to fetch");
        const data = await issuesResponse.json();
        const sessionData = await sessionResponse.json();
        setIssues(data);
        setSession(sessionData);
      } catch (error) {
        console.error("Error fetching issues:", error);
      }
    };
    fetchData();
  }, []);

  // Filter issues based on search query and status
  const filteredIssues = issues
    .filter((issue) => {
      const matchesSearch = issue.subject
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === "all" ||
        issue.status.toLowerCase() === statusFilter.toLowerCase();
      const matchesApproval =
        approvedFilter === "all" ||
        (approvedFilter === "approved" && issue.approved) ||
        (approvedFilter === "notApproved" && !issue.approved);
      return matchesSearch && matchesStatus && matchesApproval;
    })
    .sort((a, b) => {
      // Sort Urgent issues first
      if (a.status === "Urgent" && b.status !== "Urgent") return -1;
      if (a.status !== "Urgent" && b.status === "Urgent") return 1;
      // For non-urgent issues, sort by creation date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  // Calculate metrics
  const totalIssues = issues.length;
  const unassignedIssues = issues.filter((issue) => !issue.assignedTo).length;
  const assignedIssues = issues.filter((issue) => issue.assignedTo).length;

  // Filter users based on search
  const filteredUsers = users.filter((user) =>
    user.username.toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  // Handle issue assignment
  const handleAssign = async (issueId: string, username: string) => {
    try {
      console.log("Assigning Issue:", { issueId, username });

      const response = await fetch(`/api/issues/${issueId}/assign`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ assignedTo: username, status: "Pending" }),
      });

      if (!response.ok) {
        throw new Error(`Failed to assign issue. Status: ${response.status}`);
      }

      const updatedIssue = await response.json();

      setIssues(
        issues.map((issue) =>
          issue._id === issueId
            ? {
                ...issue,
                assignedTo: updatedIssue.assignedTo,
                status: updatedIssue.status,
              }
            : issue
        )
      );

      setIsAssignDialogOpen(false);
    } catch (error) {
      console.error("Error assigning issue:", error);
    }
  };

  const handleApprove = async (issueId: string) => {
    try {
      const response = await fetch(`/api/issues/${issueId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ approved: true }),
      });

      if (!response.ok) {
        throw new Error(`Failed to approve issue. Status: ${response.status}`);
      }

      const updatedIssue = await response.json();

      setIssues(
        issues.map((issue) =>
          issue._id === issueId
            ? {
                ...issue,
                approved: updatedIssue.approved,
              }
            : issue
        )
      );
    } catch (error) {
      console.error("Error approving issue:", error);
    }
  };

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

  return (
    <main className="container mx-auto px-4 py-8 w-[90%] space-y-6">
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium">Total Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalIssues}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium">
              Unassigned Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-600">
              {unassignedIssues}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium">
              Assigned Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">
              {assignedIssues}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <Input
            placeholder="Search issues..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
          <div className="flex gap-2">
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
            <Select
              defaultValue="all"
              onValueChange={(value) => setApprovedFilter(value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by approval" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Issues</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="notApproved">Not Approved</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
            {paginatedIssues.map((issue) => (
              <TableRow
                key={issue._id}
                className={cn(issue.status === "Urgent" && "bg-red-50/50")}
              >
                <TableCell className="font-medium">{issue.subject}</TableCell>
                <TableCell>{issue.category}</TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
                      {
                        "bg-yellow-100 text-yellow-700":
                          issue.status === "Pending",
                        "bg-red-100 text-red-700": issue.status === "Overdue",
                        "bg-green-100 text-green-700":
                          issue.status === "Closed",
                        "bg-blue-100 text-blue-700": issue.status === "Open",
                        "bg-red-100 text-red-700 animate-pulse":
                          issue.status === "Urgent",
                      }
                    )}
                  >
                    {issue.status}
                  </span>
                </TableCell>
                <TableCell>{issue.assignedTo || "Unassigned"}</TableCell>

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
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedIssue(issue);
                          setIsAssignDialogOpen(true);
                        }}
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        Assign
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleApprove(issue._id)}
                        disabled={issue.approved}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        {issue.approved ? "Approved" : "Approve"}
                      </DropdownMenuItem>
                      {session?.username === issue.assignedTo &&
                        issue.status !== "Closed" && (
                          <DropdownMenuItem
                            onClick={() => openResolveDialog(issue)}
                          >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Resolve
                          </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
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
                          selectedIssue.status === "Overdue",
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
                    <p className="font-medium">{selectedIssue.submittedBy}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">
                      Assigned To
                    </h3>
                    <p className="font-medium">
                      {selectedIssue.assignedTo || "Unassigned"}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">
                      Approved
                    </h3>
                    <p className="font-medium">
                      {selectedIssue.approved ? "Yes" : "No"}
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

        {/* Assign User Dialog */}
        <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Assign Issue</DialogTitle>
            </DialogHeader>
            <Command>
              <CommandInput
                placeholder="Search users..."
                value={userSearchQuery}
                onValueChange={setUserSearchQuery}
                className="border-none focus:ring-0"
              />
              <CommandList className="max-h-[300px] overflow-y-auto">
                {filteredUsers.map((user) => (
                  <CommandItem
                    key={user.id}
                    onSelect={() => {
                      if (selectedIssue) {
                        handleAssign(selectedIssue._id, user.username);
                      }
                    }}
                    className="flex items-center px-4 py-3 cursor-pointer transition-colors hover:bg-gray-100 active:bg-gray-200 rounded-md group"
                  >
                    <div className="flex items-center space-x-3 w-full">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-blue-600 font-semibold text-sm">
                            {user.username.slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600">
                            {user.username}
                          </p>
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {user.personnelType}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 truncate">
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
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
              <Button onClick={handleResolve}>Resolve Issue</Button>
            </DialogFooter>
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
