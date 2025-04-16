"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import Logo from "@/public/imgs/logo.png";
import Marketing from "@/public/imgs/marketing.jpeg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleLogin = async () => {
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.personnelType === "Md") {
          router.push("/MD/home");
        } else if (data.personnelType === "Staff") {
          router.push("/staff/home");
        }
      } else {
        // console.error("Login failed");
        toast.error("Invalid credentials. Please try again.");
      }
    } catch (error) {
      console.error("Error during login:", error);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Marketing Section */}
      <div className="hidden lg:block lg:w-1/2 relative">
        <Image
          src={Marketing || "/placeholder.svg"}
          alt="marketing image"
          className="object-cover"
          fill
          priority
          sizes="50vw"
        />
      </div>

      {/* Right side - Authentication Section */}
      <div className="w-full lg:w-1/2 bg-[#13263c] p-8 flex items-center justify-center">
        <Card className="w-full max-w-md p-8 shadow-lg bg-[#13263c] border-none">
          <CardContent>
            <div className="flex justify-center mb-12">
              <Image
                src={Logo || "/placeholder.svg"}
                alt="nssf logo"
                height={100}
                priority
              />
            </div>

            <div className="space-y-4">
              <Input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-white"
              />
              <Input
                type="password" // Password input
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-white"
              />
              <Button
                className="w-full py-3.5 px-4 bg-[#6CBE45] text-white rounded-lg
                          font-medium shadow-sm hover:bg-[#6CBE45]
                          transition-colors duration-200"
                onClick={handleLogin}
              >
                Authenticate
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
