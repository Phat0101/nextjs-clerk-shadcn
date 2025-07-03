"use client";

import React from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSearchParams } from "next/navigation";
import ClientView from "@/components/role-views/ClientView";
import CompilerView from "@/components/role-views/CompilerView";
import AdminView from "@/components/role-views/AdminView";

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const currentView = searchParams.get('view') || "dashboard";
  const currentUser = useQuery(api.users.getCurrent);

  if (currentUser === undefined) {
    return <div className="p-6">Loading...</div>;
  }

  if (!currentUser) {
    return <div className="p-6">Setting up your account...</div>;
  }

  const renderContent = () => {
    switch (currentUser.role) {
      case "CLIENT":
        return (
          <ClientView 
            currentView={currentView} 
            onViewChange={() => {}} // Navigation handled by layout
          />
        );
      case "COMPILER":
        return (
          <CompilerView 
            currentView={currentView} 
            onViewChange={() => {}} // Navigation handled by layout
          />
        );
      case "ADMIN":
        return (
          <AdminView 
            currentView={currentView} 
            onViewChange={() => {}} // Navigation handled by layout
          />
        );
      default:
        return <div className="p-6">Unknown user role</div>;
    }
  };

  return renderContent();
} 