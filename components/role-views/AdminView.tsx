/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import React from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, FileText, BarChart3, DollarSign, Mail } from "lucide-react";

// Import all the separated admin view components
import UserManagementView from "./admin/UserManagementView";
import AnalyticsView from "./admin/AnalyticsView";
import AllJobsView from "./admin/AllJobsView";
import PricingManagementView from "./admin/PricingManagementView";
import CommissionSettingsView from "./admin/CommissionSettingsView";
import ProcessingSettingsView from "./admin/ProcessingSettingsView";
import InboxView from "./admin/InboxView";

interface AdminViewProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

export default function AdminView({ currentView, onViewChange }: AdminViewProps) {
  const stats = useQuery(api.myFunctions.getDashboardStats);
  const allUsers = useQuery(api.users.getAll);

  if (stats === undefined || allUsers === undefined) {
    return <div className="p-6">Loading...</div>;
  }

  if (currentView === "users") {
    return <UserManagementView users={allUsers} />;
  }

  if (currentView === "analytics") {
    return <AnalyticsView stats={stats as any} />;
  }

  if (currentView === "all-jobs") {
    return <AllJobsView />;
  }

  if (currentView === "pricing") {
    return <PricingManagementView />;
  }

  if (currentView === "commission-settings") {
    return <CommissionSettingsView />;
  }

  if (currentView === "processing-settings") {
    return <ProcessingSettingsView />;
  }

  if (currentView === "inbox") {
    return <InboxView />;
  }

  // Dashboard view
  const clientUsers = allUsers.filter(user => user.role === "CLIENT");
  const compilerUsers = allUsers.filter(user => user.role === "COMPILER");
  const adminUsers = allUsers.filter(user => user.role === "ADMIN");

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600">Monitor and manage the CompileFlow platform</p>
        </div>
      </div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalJobs}</div>
            <div className="text-xs text-gray-500 mt-1">
              {stats?.completedJobs} completed • {stats?.inProgressJobs} in progress • {stats?.pendingJobs} pending
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Clients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalClients}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Avg Job Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${((stats?.averageJobValue || 0) / 100).toFixed(2)}</div>
            <div className="text-xs text-gray-500 mt-1">Per completed job</div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Breakdown - Only show if there are completed jobs */}
      {stats?.completedJobs && stats.completedJobs > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Gross Revenue</CardTitle>
              <p className="text-xs text-gray-500">Total paid by clients</p>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                ${((stats?.grossRevenue || 0) / 100).toFixed(2)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Company Revenue</CardTitle>
              <p className="text-xs text-gray-500">Net after commission ({stats?.companyCommission}%)</p>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                ${((stats?.companyRevenue || 0) / 100).toFixed(2)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Compiler Revenue</CardTitle>
              <p className="text-xs text-gray-500">Total paid to compilers ({stats?.compilerCommission}%)</p>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                ${((stats?.compilerRevenue || 0) / 100).toFixed(2)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Avg Company Revenue</CardTitle>
              <p className="text-xs text-gray-500">Per completed job</p>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                ${((stats?.averageCompanyRevenue || 0) / 100).toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onViewChange("users")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              User Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              {clientUsers.length} Clients, {compilerUsers.length} Compilers, {adminUsers.length} Admins
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onViewChange("all-jobs")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Job Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              View and manage all platform jobs
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onViewChange("pricing")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Pricing Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Create and manage price units
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onViewChange("commission-settings")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Commission Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Manage compiler and company commission rates
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onViewChange("processing-settings")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Processing Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Configure job processing behavior
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onViewChange("inbox")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Inbox Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Manage inbound emails and job creation
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onViewChange("analytics")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Platform performance and metrics
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Users */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Recent Users</CardTitle>
            <Button variant="outline" onClick={() => onViewChange("users")}>
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {allUsers.slice(0, 5).map((user) => (
              <div key={user._id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <h3 className="font-medium">{user.name}</h3>
                  <p className="text-sm text-gray-500">{user.email}</p>
                </div>
                <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
                  {user.role}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}