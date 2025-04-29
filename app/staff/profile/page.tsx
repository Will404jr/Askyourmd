"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import {
  UserIcon,
  MailIcon,
  BriefcaseIcon,
  CalendarIcon,
  LogOutIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface SessionData {
  id: string;
  username: string;
  email: string;
  personnelType: string;
  isLoggedIn: boolean;
  expiresAt: number;
}

export default function UserProfilePage() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch("/api/session");

        if (!response.ok) {
          if (response.status === 401) {
            // Not authenticated, redirect to login
            router.push("/login");
            return;
          }
          throw new Error(`Failed to fetch session: ${response.statusText}`);
        }

        const data = await response.json();
        setSession(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch("/api/saml/logout");
      router.push("/login");
    } catch (err) {
      console.error("Error logging out:", err);
    }
  };

  // Format expiration date
  const formatExpirationDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  if (loading) {
    return (
      <div className="container max-w-2xl py-10">
        <Card>
          <CardHeader className="pb-4">
            <Skeleton className="h-8 w-1/3 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-[200px]" />
                <Skeleton className="h-4 w-[150px]" />
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-2xl py-10">
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-500">Error</CardTitle>
            <CardDescription>
              There was a problem loading your profile
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => router.push("/login")}>
              Return to Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="container max-w-2xl py-10">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-2xl">User Profile</CardTitle>
              <CardDescription>Your account information</CardDescription>
            </div>
            <Badge
              variant={session.personnelType === "Md" ? "default" : "secondary"}
            >
              {session.personnelType}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center space-x-4">
            <Avatar className="h-16 w-16">
              <AvatarImage
                src={`https://avatar.vercel.sh/${session.username}`}
                alt={session.username}
              />
              <AvatarFallback>{getInitials(session.username)}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-xl font-medium">{session.username}</h3>
              <p className="text-sm text-muted-foreground">
                User ID: {session.id}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <UserIcon className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Username
                </p>
                <p>{session.username}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <MailIcon className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Email
                </p>
                <p>{session.email}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <BriefcaseIcon className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Role
                </p>
                <p>{session.personnelType}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <CalendarIcon className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Session Expires
                </p>
                <p>{formatExpirationDate(session.expiresAt)}</p>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={() => router.back()}>
            Back
          </Button>
          <Button
            variant="destructive"
            onClick={handleLogout}
            className="flex items-center gap-2"
          >
            <LogOutIcon className="h-4 w-4" />
            Logout
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
