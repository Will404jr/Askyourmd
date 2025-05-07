"use client";

import { useState, useEffect, Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Image from "next/image";
import Logo from "@/public/imgs/logo.png";
import Marketing from "@/public/imgs/patrick_ayota.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { LockIcon, UserIcon, ShieldIcon } from "lucide-react";

// Create a separate component for the part that uses useSearchParams
const LoginForm = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [activeTab, setActiveTab] = useState("staff");
  const router = useRouter();

  // Import useSearchParams inside this component
  const { useSearchParams } = require("next/navigation");
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check for error in URL
    const error = searchParams?.get("error");
    if (error) {
      const errorDetails = searchParams?.get("details") || "";
      let errorMessage = "Authentication failed. Please try again.";

      switch (error) {
        case "azure_ad_error":
          errorMessage = `Azure AD error: ${errorDetails || "Unknown error"}`;
          break;
        case "invalid_state":
          errorMessage = "Invalid authentication state.";
          break;
        case "token_exchange_failed":
          errorMessage = "Failed to complete authentication.";
          break;
        case "invalid_id_token":
          errorMessage = "Invalid identity token received.";
          break;
        case "session_save_failed":
          errorMessage = "Failed to create session. Please try again.";
          break;
        default:
          errorMessage = `Authentication error: ${error}`;
      }

      toast.error(errorMessage);
    }
  }, [searchParams]);

  const handleAdminLogin = async () => {
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
        } else {
          toast.error("Invalid user type. Please try again.");
        }
      } else {
        toast.error("Invalid credentials. Please try again.");
      }
    } catch (error) {
      console.error("Error during login:", error);
      toast.error("An error occurred during login.");
    }
  };

  const handleSamlLogin = () => {
    // Redirect to our internal Azure AD login endpoint
    window.location.href = "/api/auth/stateless-login";
  };

  return (
    <div className="flex flex-col gap-6">
      <Card className="overflow-hidden h-[600px] border-none">
        <CardContent className="grid p-0 md:grid-cols-2 h-full">
          {/* Image section on the LEFT */}
          <div className="relative bg-muted h-full">
            <Image
              src={Marketing || "/placeholder.svg"}
              alt="marketing image"
              fill
              className="object-cover"
              style={{ objectPosition: "center 30%" }}
              priority
              sizes="50vw"
            />
          </div>

          {/* Form section on the RIGHT */}
          <div className="p-6 md:p-8 flex flex-col justify-center items-center bg-[#13263c] h-full">
            <div className="w-full max-w-md flex flex-col items-center">
              <div className="flex justify-center mb-8">
                <Image
                  src={Logo || "/placeholder.svg"}
                  alt="nssf logo"
                  height={80}
                  priority
                />
              </div>

              <div className="flex flex-col gap-6 w-full">
                <div className="flex flex-col items-center text-center">
                  <h1 className="text-2xl font-bold text-white">
                    Welcome back
                  </h1>
                </div>

                <Tabs
                  defaultValue="staff"
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="staff" className="text-sm">
                      Staff Login
                    </TabsTrigger>
                    <TabsTrigger value="admin" className="text-sm">
                      MD Login
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="staff" className="space-y-4">
                    <div className="text-center text-gray-400 mb-4"></div>
                    <Button
                      className="w-full py-5 px-4 bg-[#0078d4] text-white rounded-lg font-medium shadow-sm hover:bg-[#006cbe] transition-colors duration-200 flex items-center justify-center gap-2"
                      onClick={handleSamlLogin}
                    >
                      <ShieldIcon className="h-5 w-5" />
                      Login with Microsoft SSO
                    </Button>
                  </TabsContent>

                  <TabsContent value="admin" className="space-y-4">
                    <div className="space-y-4">
                      <div className="grid gap-2">
                        <Label htmlFor="username" className="text-gray-300">
                          Username
                        </Label>
                        <div className="relative">
                          <UserIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                          <Input
                            id="username"
                            type="text"
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="pl-10 bg-[#1a324d] border-[#2a4060] text-white"
                          />
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <div className="flex items-center">
                          <Label htmlFor="password" className="text-gray-300">
                            Password
                          </Label>
                        </div>
                        <div className="relative">
                          <LockIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                          <Input
                            id="password"
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="pl-10 bg-[#1a324d] border-[#2a4060] text-white"
                          />
                        </div>
                      </div>

                      <Button
                        className="w-full py-3.5 px-4 bg-[#6CBE45] text-white rounded-lg font-medium shadow-sm hover:bg-[#5ba93a] transition-colors duration-200"
                        onClick={handleAdminLogin}
                      >
                        Authenticate
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Main component that uses Suspense
const LoginPage = () => {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-[#03040d] p-6 md:p-10">
      <div className="w-full max-w-5xl">
        <Suspense
          fallback={
            <div className="text-white text-center">Loading login form...</div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
};

export default LoginPage;
