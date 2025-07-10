"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, ChevronDown, ChevronRight } from "lucide-react";

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
  const [platformExpanded, setPlatformExpanded] = useState(true);
  const [revenueExpanded, setRevenueExpanded] = useState(true);
  const [averagesExpanded, setAveragesExpanded] = useState(true);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Analytics Dashboard</h1>
      {/* Platform Overview */}
      <div className="space-y-2">
        <div className="flex items-center justify-start">
          <h2 className="text-base font-medium text-gray-900 mr-2">Platform Overview</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPlatformExpanded(!platformExpanded)}
            className="h-6 w-6 p-0 bg-gray-100"
          >
            {platformExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </Button>
        </div>
        
        {platformExpanded && (
          <div className="overflow-hidden border border-gray-200 rounded-lg">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-1/3 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Metric</th>
                  <th className="w-1/4 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                  <th className="w-auto px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="w-1/3 px-3 py-2 whitespace-nowrap">
                    <span className="text-xs font-medium text-gray-900">Total Jobs</span>
                  </td>
                  <td className="w-1/4 px-3 py-2 whitespace-nowrap">
                    <span className="text-lg font-semibold text-gray-900">{stats?.totalJobs || 0}</span>
                  </td>
                  <td className="w-auto px-3 py-2 whitespace-nowrap">
                    <span className="text-xs text-gray-600">
                      {stats?.completedJobs || 0} completed • {stats?.inProgressJobs || 0} in progress • {stats?.pendingJobs || 0} pending
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="w-1/3 px-3 py-2 whitespace-nowrap">
                    <span className="text-xs font-medium text-gray-900">Total Users</span>
                  </td>
                  <td className="w-1/4 px-3 py-2 whitespace-nowrap">
                    <span className="text-lg font-semibold text-gray-900">{stats?.totalUsers || 0}</span>
                  </td>
                  <td className="w-auto px-3 py-2 whitespace-nowrap">
                    <span className="text-xs text-gray-600">All platform users</span>
                  </td>
                </tr>
                <tr>
                  <td className="w-1/3 px-3 py-2 whitespace-nowrap">
                    <span className="text-xs font-medium text-gray-900">Total Clients</span>
                  </td>
                  <td className="w-1/4 px-3 py-2 whitespace-nowrap">
                    <span className="text-lg font-semibold text-gray-900">{stats?.totalClients || 0}</span>
                  </td>
                  <td className="w-auto px-3 py-2 whitespace-nowrap">
                    <span className="text-xs text-gray-600">Active client companies</span>
                  </td>
                </tr>
                <tr>
                  <td className="w-1/3 px-3 py-2 whitespace-nowrap">
                    <span className="text-xs font-medium text-gray-900">Completion Rate</span>
                  </td>
                  <td className="w-1/4 px-3 py-2 whitespace-nowrap">
                    <span className="text-lg font-semibold text-blue-600">
                      {stats?.totalJobs > 0 ? Math.round(((stats?.completedJobs || 0) / stats.totalJobs) * 100) : 0}%
                    </span>
                  </td>
                  <td className="w-auto px-3 py-2 whitespace-nowrap">
                    <span className="text-xs text-gray-600">Of all jobs submitted</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Revenue Analytics - Only show if there are completed jobs */}
      {stats?.completedJobs && stats.completedJobs > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-start">
            <h2 className="text-base font-medium text-gray-900 mr-2">Revenue Analytics</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRevenueExpanded(!revenueExpanded)}
              className="h-6 w-6 p-0 bg-gray-100"
            >
              {revenueExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </Button>
          </div>
          
          {revenueExpanded && (
            <div className="overflow-hidden border border-gray-200 rounded-lg">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-1/3 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue Type</th>
                    <th className="w-1/4 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="w-auto px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="w-1/3 px-3 py-2 whitespace-nowrap">
                      <span className="text-xs font-medium text-gray-900">Gross Revenue</span>
                    </td>
                    <td className="w-1/4 px-3 py-2 whitespace-nowrap">
                      <span className="text-lg font-semibold text-blue-600">
                        ${((stats?.grossRevenue || 0) / 100).toFixed(2)}
                      </span>
                    </td>
                    <td className="w-auto px-3 py-2 whitespace-nowrap">
                      <span className="text-xs text-gray-600">Total paid by clients</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="w-1/3 px-3 py-2 whitespace-nowrap">
                      <span className="text-xs font-medium text-gray-900">Company Revenue</span>
                    </td>
                    <td className="w-1/4 px-3 py-2 whitespace-nowrap">
                      <span className="text-lg font-semibold text-green-600">
                        ${((stats?.companyRevenue || 0) / 100).toFixed(2)}
                      </span>
                    </td>
                    <td className="w-auto px-3 py-2 whitespace-nowrap">
                      <span className="text-xs text-gray-600">Net after commissions ({stats?.companyCommission || 30}%)</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="w-1/3 px-3 py-2 whitespace-nowrap">
                      <span className="text-xs font-medium text-gray-900">Compiler Revenue</span>
                    </td>
                    <td className="w-1/4 px-3 py-2 whitespace-nowrap">
                      <span className="text-lg font-semibold text-purple-600">
                        ${((stats?.compilerRevenue || 0) / 100).toFixed(2)}
                      </span>
                    </td>
                    <td className="w-auto px-3 py-2 whitespace-nowrap">
                      <span className="text-xs text-gray-600">Total paid to compilers ({stats?.compilerCommission || 70}%)</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Average Metrics */}
      {stats?.completedJobs && stats.completedJobs > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-start">
            <h2 className="text-base font-medium text-gray-900 mr-2">Average Metrics</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAveragesExpanded(!averagesExpanded)}
              className="h-6 w-6 p-0 bg-gray-100"
            >
              {averagesExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </Button>
          </div>
          
          {averagesExpanded && (
            <div className="overflow-hidden border border-gray-200 rounded-lg">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-1/3 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Metric</th>
                    <th className="w-1/4 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                    <th className="w-auto px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Basis</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="w-1/3 px-3 py-2 whitespace-nowrap">
                      <span className="text-xs font-medium text-gray-900">Avg Job Value</span>
                    </td>
                    <td className="w-1/4 px-3 py-2 whitespace-nowrap">
                      <span className="text-lg font-semibold text-gray-900">
                        ${((stats?.averageJobValue || 0) / 100).toFixed(2)}
                      </span>
                    </td>
                    <td className="w-auto px-3 py-2 whitespace-nowrap">
                      <span className="text-xs text-gray-600">Per completed job</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="w-1/3 px-3 py-2 whitespace-nowrap">
                      <span className="text-xs font-medium text-gray-900">Avg Company Revenue</span>
                    </td>
                    <td className="w-1/4 px-3 py-2 whitespace-nowrap">
                      <span className="text-lg font-semibold text-green-600">
                        ${((stats?.averageCompanyRevenue || 0) / 100).toFixed(2)}
                      </span>
                    </td>
                    <td className="w-auto px-3 py-2 whitespace-nowrap">
                      <span className="text-xs text-gray-600">Per completed job</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="w-1/3 px-3 py-2 whitespace-nowrap">
                      <span className="text-xs font-medium text-gray-900">Revenue per User</span>
                    </td>
                    <td className="w-1/4 px-3 py-2 whitespace-nowrap">
                      <span className="text-lg font-semibold text-blue-600">
                        ${stats?.totalUsers > 0 ? (((stats?.grossRevenue || 0) / stats.totalUsers) / 100).toFixed(2) : '0.00'}
                      </span>
                    </td>
                    <td className="w-auto px-3 py-2 whitespace-nowrap">
                      <span className="text-xs text-gray-600">Gross revenue per user</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="w-1/3 px-3 py-2 whitespace-nowrap">
                      <span className="text-xs font-medium text-gray-900">Revenue per Client</span>
                    </td>
                    <td className="w-1/4 px-3 py-2 whitespace-nowrap">
                      <span className="text-lg font-semibold text-blue-600">
                        ${stats?.totalClients > 0 ? (((stats?.grossRevenue || 0) / stats.totalClients) / 100).toFixed(2) : '0.00'}
                      </span>
                    </td>
                    <td className="w-auto px-3 py-2 whitespace-nowrap">
                      <span className="text-xs text-gray-600">Gross revenue per client</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* No Revenue Data Message */}
      {(!stats?.completedJobs || stats.completedJobs === 0) && (
        <div className="border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-gray-500">
            <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <h3 className="text-base font-medium mb-1">No Revenue Data Available</h3>
            <p className="text-xs">Revenue analytics will appear once jobs are completed.</p>
          </div>
        </div>
      )}
    </div>
  );
} 