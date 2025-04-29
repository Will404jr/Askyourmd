"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Image from "next/image";
import Logo from "@/public/imgs/logo.png";
import Marketing from "@/public/imgs/marketing.jpeg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { LockIcon, UserIcon, ShieldIcon } from "lucide-react";

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [activeTab, setActiveTab] = useState("admin");
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check for error in URL
    const error = searchParams.get("error");
    if (error === "saml_failed") {
      toast.error("SAML authentication failed. Please try again.");
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
    // Redirect to SAML login endpoint
    window.location.href = "/api/saml/login";
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
            <div className="flex justify-center mb-8">
              <Image
                src={Logo || "/placeholder.svg"}
                alt="nssf logo"
                height={100}
                priority
              />
            </div>

            <Tabs
              defaultValue="admin"
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="admin" className="text-sm">
                  Admin/MD Login
                </TabsTrigger>
                <TabsTrigger value="staff" className="text-sm">
                  Staff Login
                </TabsTrigger>
              </TabsList>

              <TabsContent value="admin" className="space-y-4">
                <div className="space-y-4">
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="bg-white pl-10"
                    />
                  </div>
                  <div className="relative">
                    <LockIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <Input
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-white pl-10"
                    />
                  </div>
                  <Button
                    className="w-full py-3.5 px-4 bg-[#6CBE45] text-white rounded-lg font-medium shadow-sm hover:bg-[#5ba93a] transition-colors duration-200"
                    onClick={handleAdminLogin}
                  >
                    Authenticate
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="staff" className="space-y-4">
                <div className="text-center text-white mb-4">
                  <p className="mb-2">
                    Staff members can login using their NSSF credentials
                  </p>
                </div>
                <Button
                  className="w-full py-5 px-4 bg-[#0078d4] text-white rounded-lg font-medium shadow-sm hover:bg-[#006cbe] transition-colors duration-200 flex items-center justify-center gap-2"
                  onClick={handleSamlLogin}
                >
                  <ShieldIcon className="h-5 w-5" />
                  Login with Microsoft SSO
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
