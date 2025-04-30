"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// This is a simple redirect page that checks the session and redirects accordingly
export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Fetch the session data
    const checkSession = async () => {
      try {
        const response = await fetch("/api/session");

        if (response.ok) {
          const session = await response.json();

          // Redirect based on user type
          if (session.personnelType === "Md") {
            router.push("/MD/home");
          } else if (session.personnelType === "Staff") {
            router.push("/staff/home");
          } else {
            // If no personnel type is set, redirect to login
            router.push("/login");
          }
        } else {
          // If session fetch fails, redirect to login
          router.push("/login");
        }
      } catch (error) {
        console.error("Error checking session:", error);
        router.push("/login");
      }
    };

    checkSession();
  }, [router]);

  // Show a loading state while checking the session
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#13263c]">
      <div className="text-white text-center">
        <h1 className="text-2xl font-bold mb-4">Loading...</h1>
        <p>Please wait while we redirect you to the appropriate page.</p>
      </div>
    </div>
  );
}
