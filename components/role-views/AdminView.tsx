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
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Admin Dashboard</h1>
        <p className="text-sm text-gray-600">Monitor and manage the OBO platform</p>
      </div>

      {/* Platform Overview and Revenue Analytics */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="space-y-2">
          <h2 className="text-base font-medium text-gray-900 mb-0">Platform Overview</h2>
          <div className="overflow-hidden border border-gray-200 rounded-lg">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Metric</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center">
                      <FileText className="w-4 h-4 text-gray-500 mr-2" />
                      <span className="text-xs font-medium text-gray-900">Total Jobs</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="text-lg font-semibold text-gray-900">{stats?.totalJobs || 0}</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="flex items-center gap-1">
                        <CheckCircle className="w-2.5 h-2.5 text-green-500" />
                        {stats?.completedJobs || 0} completed
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5 text-blue-500" />
                        {stats?.inProgressJobs || 0} active
                      </span>
                      <span className="flex items-center gap-1">
                        <AlertCircle className="w-2.5 h-2.5 text-orange-500" />
                        {stats?.pendingJobs || 0} pending
                      </span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center">
                      <Users className="w-4 h-4 text-gray-500 mr-2" />
                      <span className="text-xs font-medium text-gray-900">Platform Users</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="text-lg font-semibold text-gray-900">{stats?.totalUsers || 0}</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span>{clientUsers.length} clients</span>
                      <span>•</span>
                      <span>{compilerUsers.length} compilers</span>
                      <span>•</span>
                      <span>{adminUsers.length} admins</span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center">
                      <Building2 className="w-4 h-4 text-gray-500 mr-2" />
                      <span className="text-xs font-medium text-gray-900">Active Clients</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="text-lg font-semibold text-gray-900">{stats?.totalClients || 0}</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="text-xs text-gray-600">Organizations using the platform</span>
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center">
                      <DollarSign className="w-4 h-4 text-gray-500 mr-2" />
                      <span className="text-xs font-medium text-gray-900">Avg Job Value</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="text-lg font-semibold text-gray-900">${((stats?.averageJobValue || 0) / 100).toFixed(2)}</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="text-xs text-gray-600">Average value per completed job</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Revenue Analytics */}
        <div className="space-y-2">
          {stats?.completedJobs && stats.completedJobs > 0 && (
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-medium text-gray-900">Revenue Analytics</h2>
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <TrendingUp className="w-3 h-3" />
                  Based on {stats.completedJobs} completed jobs
                </div>
              </div>
              
              <div className="overflow-hidden border border-gray-200 rounded-lg">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue Type</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    <tr>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="text-xs font-medium text-gray-900">Gross Revenue</span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="text-lg font-semibold text-blue-600">${((stats?.grossRevenue || 0) / 100).toFixed(2)}</span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="text-xs text-gray-600">Total client payments</span>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="text-xs font-medium text-gray-900">Company Revenue</span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="text-lg font-semibold text-green-600">${((stats?.companyRevenue || 0) / 100).toFixed(2)}</span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="text-xs text-gray-600">After {stats?.companyCommission}% commission</span>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="text-xs font-medium text-gray-900">Compiler Revenue</span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="text-lg font-semibold text-purple-600">${((stats?.compilerRevenue || 0) / 100).toFixed(2)}</span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="text-xs text-gray-600">Paid to compilers ({stats?.compilerCommission}%)</span>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="text-xs font-medium text-gray-900">Avg Company Revenue</span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="text-lg font-semibold text-green-600">${((stats?.averageCompanyRevenue || 0) / 100).toFixed(2)}</span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="text-xs text-gray-600">Per completed job</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium text-gray-900">Recent Users</h2>
          <Button 
            variant="outline" 
            onClick={() => onViewChange("users")}
            className="text-xs h-7"
          >
            View All Users
          </Button>
        </div>

        <Card className="p-0">
          <CardContent className="p-0">
            <div className="divide-y divide-gray-200">
              {allUsers.slice(0, 5).map((user, index) => (
                <div key={user._id} className="p-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-gray-600">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-medium text-xs text-gray-900">{user.name}</h3>
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