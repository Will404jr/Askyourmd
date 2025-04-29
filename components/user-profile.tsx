"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

interface UserProfileProps {
  user: {
    id: string;
    username: string;
    email: string;
    personnelType: string;
    givenName?: string;
    surname?: string;
  };
}

export default function UserProfile({ user }: UserProfileProps) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/logout");
    router.push("/login");
  };

  const initials =
    user.givenName && user.surname
      ? `${user.givenName[0]}${user.surname[0]}`
      : user.username
          .split(" ")
          .map((n) => n[0])
          .join("");

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="flex flex-row items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarImage
            src={`https://ui-avatars.com/api/?name=${user.username}&background=6CBE45&color=fff`}
          />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div>
          <CardTitle>{user.username}</CardTitle>
          <p className="text-sm text-gray-500">{user.personnelType}</p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium">Email</p>
            <p>{user.email}</p>
          </div>
          {user.givenName && (
            <div>
              <p className="text-sm font-medium">First Name</p>
              <p>{user.givenName}</p>
            </div>
          )}
          {user.surname && (
            <div>
              <p className="text-sm font-medium">Last Name</p>
              <p>{user.surname}</p>
            </div>
          )}
          <Button
            variant="destructive"
            className="w-full mt-4"
            onClick={handleLogout}
          >
            Logout
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
