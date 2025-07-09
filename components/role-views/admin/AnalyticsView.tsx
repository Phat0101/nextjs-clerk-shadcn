"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

interface AnalyticsViewProps {
  stats: {
    totalJobs: number;
    completedJobs: number;
    inProgressJobs: number;
    pendingJobs: number;
    totalUsers: number;
    totalClients: number;
    grossRevenue: number;
    companyRevenue: number;
    compilerRevenue: number;
    companyCommission: number;
    compilerCommission: number;
    averageJobValue: number;
    averageCompanyRevenue: number;
  };
}

export default function AnalyticsView({ stats }: AnalyticsViewProps) {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
        <p className="text-gray-600">Comprehensive platform performance metrics</p>
      </div>

      {/* Platform Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalJobs || 0}</div>
            <div className="text-xs text-gray-500 mt-1">
              {stats?.completedJobs || 0} completed • {stats?.inProgressJobs || 0} in progress • {stats?.pendingJobs || 0} pending
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Clients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalClients || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalJobs > 0 ? Math.round(((stats?.completedJobs || 0) / stats.totalJobs) * 100) : 0}%
            </div>
            <div className="text-xs text-gray-500 mt-1">Of all jobs submitted</div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Analytics - Only show if there are completed jobs */}
      {stats?.completedJobs && stats.completedJobs > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <p className="text-xs text-gray-500">Net after commissions ({stats?.companyCommission || 30}%)</p>
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
                <p className="text-xs text-gray-500">Total paid to compilers ({stats?.compilerCommission || 70}%)</p>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  ${((stats?.compilerRevenue || 0) / 100).toFixed(2)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Average Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Avg Job Value</CardTitle>
                <p className="text-xs text-gray-500">Per completed job</p>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${((stats?.averageJobValue || 0) / 100).toFixed(2)}
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
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Revenue per User</CardTitle>
                <p className="text-xs text-gray-500">Gross revenue per user</p>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${stats?.totalUsers > 0 ? (((stats?.grossRevenue || 0) / stats.totalUsers) / 100).toFixed(2) : '0.00'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Revenue per Client</CardTitle>
                <p className="text-xs text-gray-500">Gross revenue per client</p>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${stats?.totalClients > 0 ? (((stats?.grossRevenue || 0) / stats.totalClients) / 100).toFixed(2) : '0.00'}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* No Revenue Data Message */}
      {(!stats?.completedJobs || stats.completedJobs === 0) && (
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium mb-2">No Revenue Data Available</h3>
              <p className="text-sm">Revenue analytics will appear once jobs are completed.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 