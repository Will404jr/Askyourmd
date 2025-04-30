"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Fetch session info to determine user type
    async function checkSession() {
      try {
        const response = await fetch("/api/session");

        if (response.ok) {
          const data = await response.json();

          // Redirect based on user type
          if (data.personnelType === "Md") {
            router.push("/MD/home");
          } else if (data.personnelType === "Staff") {
            router.push("/Staff/home");
          } else {
            // Unknown user type, redirect to login
            router.push("/");
          }
        } else {
          // No valid session, redirect to login
          router.push("/");
        }
      } catch (error) {
        console.error("Error checking session:", error);
        router.push("/");
      }
    }

    checkSession();
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Redirecting...</h1>
        <p>Please wait while we redirect you to the appropriate dashboard.</p>
      </div>
    </div>
  );
}
