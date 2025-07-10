/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import React from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  FileText, 
  BarChart3, 
  DollarSign, 
  Mail, 
  TrendingUp, 
  Clock,
  CheckCircle,
  AlertCircle,
  Building2
} from "lucide-react";

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
    return (
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Monitor and manage the OBO platform</p>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
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
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">Monitor and manage the OBO platform</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">Total Jobs</CardTitle>
              <FileText className="w-4 h-4 text-gray-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-semibold text-gray-900 mb-1">
              {stats?.totalJobs || 0}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-green-500" />
                {stats?.completedJobs || 0} completed
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-blue-500" />
                {stats?.inProgressJobs || 0} active
              </span>
              <span className="flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-orange-500" />
                {stats?.pendingJobs || 0} pending
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">Platform Users</CardTitle>
              <Users className="w-4 h-4 text-gray-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-semibold text-gray-900 mb-1">
              {stats?.totalUsers || 0}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span>{clientUsers.length} clients</span>
              <span>•</span>
              <span>{compilerUsers.length} compilers</span>
              <span>•</span>
              <span>{adminUsers.length} admins</span>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">Active Clients</CardTitle>
              <Building2 className="w-4 h-4 text-gray-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-semibold text-gray-900 mb-1">
              {stats?.totalClients || 0}
            </div>
            <div className="text-xs text-gray-600">
              Organizations using the platform
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">Avg Job Value</CardTitle>
              <DollarSign className="w-4 h-4 text-gray-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-semibold text-gray-900 mb-1">
              ${((stats?.averageJobValue || 0) / 100).toFixed(2)}
            </div>
            <div className="text-xs text-gray-600">
              Average value per completed job
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Breakdown */}
      {stats?.completedJobs && stats.completedJobs > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">Revenue Overview</h2>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <TrendingUp className="w-4 h-4" />
              Based on {stats.completedJobs} completed jobs
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <Card className="hover:shadow-md transition-shadow duration-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">Gross Revenue</CardTitle>
                <p className="text-xs text-gray-500">Total client payments</p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-semibold text-blue-600">
                  ${((stats?.grossRevenue || 0) / 100).toFixed(2)}
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow duration-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">Company Revenue</CardTitle>
                <p className="text-xs text-gray-500">After {stats?.companyCommission}% commission</p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-semibold text-green-600">
                  ${((stats?.companyRevenue || 0) / 100).toFixed(2)}
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow duration-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">Compiler Revenue</CardTitle>
                <p className="text-xs text-gray-500">Paid to compilers ({stats?.compilerCommission}%)</p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-semibold text-purple-600">
                  ${((stats?.compilerRevenue || 0) / 100).toFixed(2)}
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow duration-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">Avg Company Revenue</CardTitle>
                <p className="text-xs text-gray-500">Per completed job</p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-semibold text-green-600">
                  ${((stats?.averageCompanyRevenue || 0) / 100).toFixed(2)}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Management Actions */}
      <div className="space-y-6">
        <h2 className="text-lg font-medium text-gray-900">Management Tools</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card 
            className="cursor-pointer hover:shadow-md transition-all duration-200 hover:border-blue-300 group" 
            onClick={() => onViewChange("users")}
          >
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3 text-base font-medium text-gray-900 group-hover:text-blue-700">
                <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                User Management
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-gray-600 mb-3">
                Manage user roles and permissions across the platform
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>{clientUsers.length} clients</span>
                <span>•</span>
                <span>{compilerUsers.length} compilers</span>
                <span>•</span>
                <span>{adminUsers.length} admins</span>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-md transition-all duration-200 hover:border-blue-300 group" 
            onClick={() => onViewChange("all-jobs")}
          >
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3 text-base font-medium text-gray-900 group-hover:text-blue-700">
                <div className="p-2 bg-green-50 rounded-lg group-hover:bg-green-100">
                  <FileText className="w-5 h-5 text-green-600" />
                </div>
                Job Management
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-gray-600 mb-3">
                View and manage all jobs across the platform
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>{stats?.totalJobs || 0} total jobs</span>
                <span>•</span>
                <span>{stats?.completedJobs || 0} completed</span>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-md transition-all duration-200 hover:border-blue-300 group" 
            onClick={() => onViewChange("pricing")}
          >
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3 text-base font-medium text-gray-900 group-hover:text-blue-700">
                <div className="p-2 bg-purple-50 rounded-lg group-hover:bg-purple-100">
                  <DollarSign className="w-5 h-5 text-purple-600" />
                </div>
                Pricing Management
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-gray-600 mb-3">
                Configure pricing units and job rates
              </p>
              <div className="text-xs text-gray-500">
                Set competitive pricing for different job types
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-md transition-all duration-200 hover:border-blue-300 group" 
            onClick={() => onViewChange("commission-settings")}
          >
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3 text-base font-medium text-gray-900 group-hover:text-blue-700">
                <div className="p-2 bg-orange-50 rounded-lg group-hover:bg-orange-100">
                  <BarChart3 className="w-5 h-5 text-orange-600" />
                </div>
                Commission Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-gray-600 mb-3">
                Configure revenue sharing between platform and compilers
              </p>
              <div className="text-xs text-gray-500">
                Current: {stats?.compilerCommission}% compiler, {stats?.companyCommission}% company
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-md transition-all duration-200 hover:border-blue-300 group" 
            onClick={() => onViewChange("processing-settings")}
          >
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3 text-base font-medium text-gray-900 group-hover:text-blue-700">
                <div className="p-2 bg-indigo-50 rounded-lg group-hover:bg-indigo-100">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                </div>
                Processing Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-gray-600 mb-3">
                Configure automated job processing behavior
              </p>
              <div className="text-xs text-gray-500">
                AI processing, templates, and workflow automation
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-md transition-all duration-200 hover:border-blue-300 group" 
            onClick={() => onViewChange("inbox")}
          >
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3 text-base font-medium text-gray-900 group-hover:text-blue-700">
                <div className="p-2 bg-teal-50 rounded-lg group-hover:bg-teal-100">
                  <Mail className="w-5 h-5 text-teal-600" />
                </div>
                Inbox Management
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-gray-600 mb-3">
                Monitor email processing and job creation
              </p>
              <div className="text-xs text-gray-500">
                Email-to-job conversion and communication tracking
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">Recent Users</h2>
          <Button 
            variant="outline" 
            onClick={() => onViewChange("users")}
            className="text-sm"
          >
            View All Users
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-200">
              {allUsers.slice(0, 5).map((user, index) => (
                <div key={user._id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-gray-600">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-medium text-sm text-gray-900">{user.name}</h3>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>
                    <Badge 
                      variant={user.role === "ADMIN" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {user.role}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}