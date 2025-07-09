"use client";

import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [currentView, setCurrentView] = useState("dashboard");
  const currentUser = useQuery(api.users.getCurrent);
  const ensureUser = useMutation(api.users.ensureUser);
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Ensure user exists in database
  React.useEffect(() => {
    if (user && currentUser === null) {
      ensureUser();
    }
  }, [user, currentUser, ensureUser]);

  // Update current view based on pathname
  React.useEffect(() => {
    const viewParam = searchParams.get("view");
    if (viewParam) {
      setCurrentView(viewParam);
      return;
    }

    if (pathname === "/dashboard") {
      setCurrentView("dashboard");
    } else if (pathname === "/jobs/create") {
      setCurrentView("create-job");
    } else if (pathname.startsWith("/jobs/")) {
      setCurrentView("my-jobs");
    } else if (pathname === "/admin") {
      setCurrentView("users");
    } else if (pathname === "/admin/pricing") {
      setCurrentView("pricing");
    }
  }, [pathname, searchParams]);

  // Handle view changes from sidebar
  const handleViewChange = (view: string) => {
    setCurrentView(view);
    
    switch (view) {
      case "dashboard":
        router.push("/dashboard");
        break;
      case "create-job":
        router.push("/jobs/create");
        break;
      case "my-jobs":
        router.push("/dashboard?view=my-jobs");
        break;
      case "available-jobs":
        router.push("/dashboard?view=available-jobs");
        break;
      case "active-jobs":
        router.push("/dashboard?view=active-jobs");
        break;
      case "users":
        router.push("/admin");
        break;
      case "pricing":
        router.push("/admin/pricing");
        break;
      case "processing-settings":
        router.push("/dashboard?view=processing-settings");
        break;
      case "analytics":
        router.push("/dashboard?view=analytics");
        break;
      case "all-jobs":
        router.push("/dashboard?view=all-jobs");
        break;
      case "commission-settings":
        router.push("/dashboard?view=commission-settings");
        break;
      case "completed-jobs":
        router.push("/dashboard?view=completed-jobs");
        break;
      case "finished-jobs":
        router.push("/dashboard?view=finished-jobs");
        break;
      default:
        router.push("/dashboard");
    }
  };

  if (currentUser === undefined) {
    return (
      <div className="flex h-screen">
        <div className="w-64 bg-gray-50 border-r animate-pulse">
          <div className="p-4">
            <div className="h-8 bg-gray-200 rounded mb-4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex h-screen">
        <div className="w-64 bg-gray-50 border-r"></div>
        <div className="flex-1 flex items-center justify-center">
          <div>Setting up your account...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar currentView={currentView} onViewChange={handleViewChange} />
      <main className="flex-1 overflow-auto bg-white ml-16">
        {children}
      </main>
    </div>
  );
} 