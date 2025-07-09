/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, FileText, BarChart3, Plus, Edit, Trash2, DollarSign } from "lucide-react";
import TimeRemaining from "@/components/TimeRemaining";

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
    return <AnalyticsView stats={stats} />;
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

function UserManagementView({ users }: { users: Array<{
  _id: string;
  name: string;
  email: string;
  role: string;
}> }) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">User Management</h1>
      <div className="grid gap-4">
        {users.map((user) => (
          <Card key={user._id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{user.name}</h3>
                  <p className="text-sm text-gray-500">{user.email}</p>
                </div>
                <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
                  {user.role}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function AnalyticsView({ stats }: { stats: any }) {
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

function AllJobsView() {
  const [editingDeadline, setEditingDeadline] = useState<string | null>(null);
  const [newDeadlineHours, setNewDeadlineHours] = useState<number>(24);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  
  const allJobs = useQuery(api.jobs.getAll);
  const deleteJob = useMutation(api.jobs.deleteJob);
  const updateJobDeadline = useMutation(api.jobs.updateJobDeadline);

  const stepOrder: Record<string, number> = {
    selecting: 0,
    analyzing: 1,
    confirming: 2,
    extracting: 3,
    reviewing: 4,
    completed: 5,
  };

  const ProgressBar = ({ step }: { step: keyof typeof stepOrder }) => {
    const percent = (stepOrder[step] ?? 0) / 5 * 100;
    return (
      <div className="h-1 bg-gray-200 rounded overflow-hidden">
        <div className="bg-blue-600 h-full" style={{ width: `${percent}%` }} />
      </div>
    );
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm("Are you sure you want to delete this job? This action cannot be undone.")) {
      return;
    }

    try {
      await deleteJob({ jobId: jobId as any });
    } catch (error) {
      console.error("Error deleting job:", error);
      alert("Error deleting job. Please try again.");
    }
  };

  const handleUpdateDeadline = async (jobId: string) => {
    try {
      await updateJobDeadline({ 
        jobId: jobId as any, 
        deadlineHours: newDeadlineHours 
      });
      setEditingDeadline(null);
    } catch (error) {
      console.error("Error updating deadline:", error);
      alert("Error updating deadline. Please try again.");
    }
  };

  if (allJobs === undefined) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">All Jobs</h1>
        <div>Loading...</div>
      </div>
    );
  }

  // Group jobs by status
  const receivedJobs = allJobs.filter((job: any) => job.status === "RECEIVED");
  const inProgressJobs = allJobs.filter((job: any) => job.status === "IN_PROGRESS");
  const completedJobs = allJobs.filter((job: any) => job.status === "COMPLETED");

  const JobCard = ({ job, isExpanded, onToggle }: { job: any, isExpanded: boolean, onToggle: () => void }) => {
    const jobFiles = useQuery(api.jobs.getJobFiles, { jobId: job._id });
    
    if (isExpanded) {
      return (
        <Card key={job._id} className="mb-2 cursor-pointer p-0" onClick={onToggle}>
          <CardContent className="p-3">
            <div className="space-y-3">
              {/* Summary Line */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-900 truncate">{job.title}</span>
                  <span className="text-xs text-gray-500">${(job.totalPrice / 100).toFixed(0)}</span>
                  {job.compilerName && (
                    <span className="text-xs text-gray-600 truncate">{job.compilerName}</span>
                  )}
                  {job.status === "COMPLETED" && job.completedAt ? (
                    (() => {
                      const taken = Math.round((job.completedAt - (job._creationTime || 0)) / 60000);
                      const allowed = Math.round((job.deadline - (job._creationTime || 0)) / 60000);
                      const onTime = taken <= allowed;
                      return (
                        <span
                          className={`text-xs ${onTime ? 'text-green-600' : 'text-orange-600'}`}
                          title={`Time taken ${taken} min • Deadline ${allowed} min`}
                        >
                          {taken} min
                        </span>
                      );
                    })()
                  ) : (
                  <TimeRemaining deadline={job.deadline} compact />
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingDeadline(job._id);
                      setNewDeadlineHours(job.deadlineHours);
                    }}
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteJob(job._id);
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              
              {/* Detailed Information */}
              <div className="space-y-1 text-xs text-gray-600 border-t pt-2">
                <div>ID: #{job._id.slice(-6)}</div>
                <div>Created: {new Date(job._creationTime).toLocaleDateString()}</div>
                {jobFiles && jobFiles.length > 0 && (
                  <div>
                    <div className="font-medium text-gray-700 mb-1">Files ({jobFiles.length}):</div>
                    <div className="space-y-1 pl-2">
                      {jobFiles.map((file: any) => (
                        <div key={file._id}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (file.fileUrl) {
                                window.open(file.fileUrl, '_blank');
                              }
                            }}
                            className="text-blue-600 hover:text-blue-800 hover:underline text-left"
                          >
                            {file.fileName}
                          </button>
                          {file.fileSize && (
                            <span className="text-gray-400 ml-1">
                              ({(file.fileSize / 1024 / 1024).toFixed(1)} MB)
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              {job.compilerStep && job.status !== 'COMPLETED' && (
                <div className="w-full pt-2">
                  <ProgressBar step={job.compilerStep} />
                </div>
              )}

              {editingDeadline === job._id && (
                <div className="pt-2 border-t" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <Select 
                      value={newDeadlineHours.toString()} 
                      onValueChange={(value) => setNewDeadlineHours(Number(value))}
                    >
                      <SelectTrigger className="h-7 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 hour</SelectItem>
                        <SelectItem value="4">4 hours</SelectItem>
                        <SelectItem value="12">12 hours</SelectItem>
                        <SelectItem value="24">24 hours</SelectItem>
                        <SelectItem value="48">48 hours</SelectItem>
                        <SelectItem value="72">72 hours</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button 
                      size="sm" 
                      className="h-7 px-2 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateDeadline(job._id);
                      }}
                    >
                      Save
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingDeadline(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <div 
        onClick={onToggle}
        className="bg-white border rounded-lg px-3 py-2 shadow-sm cursor-pointer hover:shadow-md transition-shadow mb-2"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium text-gray-900 truncate">{job.title}</span>
            <span className="text-xs text-gray-500">${(job.totalPrice / 100).toFixed(0)}</span>
            {job.compilerName && (
              <span className="text-xs text-gray-600 truncate">{job.compilerName}</span>
            )}
            {job.status === "COMPLETED" && job.completedAt ? (
              (() => {
                const taken = Math.round((job.completedAt - (job._creationTime || 0)) / 60000);
                const allowed = Math.round((job.deadline - (job._creationTime || 0)) / 60000);
                const onTime = taken <= allowed;
                return (
                  <span
                    className={`text-xs ${onTime ? 'text-green-600' : 'text-orange-600'}`}
                    title={`Time taken ${taken} min • Deadline ${allowed} min`}
                  >
                    {taken} min
                  </span>
                );
              })()
            ) : (
              <TimeRemaining deadline={job.deadline} compact />
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {job.compilerStep && job.status !== 'COMPLETED' && (
              <div className="w-full mt-1">
                <ProgressBar step={job.compilerStep} />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 space-y-2">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">All Jobs Management</h1>
        <p className="text-gray-600">View, manage deadlines, and delete jobs across the platform</p>
      </div>

      {/* Kanban Board */}
      <div className="h-screen grid grid-cols-3 gap-2">
        {/* Received Column */}
        <div className="flex flex-col border-r">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
            <h3 className="text-lg font-semibold text-gray-900">Received</h3>
            <Badge variant="outline" className="bg-orange-50">
              {receivedJobs.length}
            </Badge>
          </div>
          <div className="flex-1 overflow-y-auto pr-2">
            {receivedJobs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">No pending jobs</p>
              </div>
            ) : (
              receivedJobs.map((job: any) => (
                <JobCard
                  key={job._id}
                  job={job}
                  isExpanded={expandedJob === job._id}
                  onToggle={() => setExpandedJob(expandedJob === job._id ? null : job._id)}
                />
              ))
            )}
          </div>
        </div>

        {/* In Progress Column */}
        <div className="flex flex-col border-r">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <h3 className="text-lg font-semibold text-gray-900">In Progress</h3>
            <Badge variant="outline" className="bg-blue-50">
              {inProgressJobs.length}
            </Badge>
          </div>
          <div className="flex-1 overflow-y-auto pr-2">
            {inProgressJobs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">No jobs in progress</p>
              </div>
            ) : (
              inProgressJobs.map((job: any) => (
                <JobCard
                  key={job._id}
                  job={job}
                  isExpanded={expandedJob === job._id}
                  onToggle={() => setExpandedJob(expandedJob === job._id ? null : job._id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Completed Column */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <h3 className="text-lg font-semibold text-gray-900">Completed</h3>
            <Badge variant="outline" className="bg-green-50">
              {completedJobs.length}
            </Badge>
          </div>
          <div className="flex-1 overflow-y-auto pr-2">
            {completedJobs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">No completed jobs</p>
              </div>
            ) : (
              completedJobs.map((job: any) => (
                <JobCard
                  key={job._id}
                  job={job}
                  isExpanded={expandedJob === job._id}
                  onToggle={() => setExpandedJob(expandedJob === job._id ? null : job._id)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PricingManagementView() {
  const [isCreating, setIsCreating] = useState(false);
  const [editingUnit, setEditingUnit] = useState<string | null>(null);
  
  const priceUnits = useQuery(api.priceUnits.getAll);
  const createPriceUnit = useMutation(api.priceUnits.create);
  const updatePriceUnit = useMutation(api.priceUnits.update);
  const deletePriceUnit = useMutation(api.priceUnits.remove);

  const handleCreateUnit = async (formData: FormData) => {
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const amount = parseFloat(formData.get("amount") as string) * 100; // Convert to cents
    const currency = formData.get("currency") as string;

    if (!name || !description || !amount || !currency) {
      alert("Please fill in all fields");
      return;
    }

    try {
      await createPriceUnit({ name, description, amount, currency, jobType: "INVOICE" });
      setIsCreating(false);
    } catch (error) {
      console.error("Error creating price unit:", error);
      alert("Error creating price unit");
    }
  };

  const handleUpdateUnit = async (formData: FormData, unitId: string) => {
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const amount = parseFloat(formData.get("amount") as string) * 100; // Convert to cents
    const currency = formData.get("currency") as string;
    const isActive = formData.get("isActive") === "true";

    if (!name || !description || !amount || !currency) {
      alert("Please fill in all fields");
      return;
    }

    try {
      const current = priceUnits?.find((u:any)=>u._id===unitId);
      await updatePriceUnit({ 
        id: unitId as any, 
        name, 
        description, 
        amount, 
        currency, 
        jobType: current?.jobType || "INVOICE",
        isActive 
      });
      setEditingUnit(null);
    } catch (error) {
      console.error("Error updating price unit:", error);
      alert("Error updating price unit");
    }
  };

  const handleDeleteUnit = async (unitId: string) => {
    if (!confirm("Are you sure you want to delete this price unit?")) {
      return;
    }

    try {
      await deletePriceUnit({ id: unitId as any });
    } catch (error) {
      console.error("Error deleting price unit:", error);
      alert("Error deleting price unit");
    }
  };

  if (priceUnits === undefined) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pricing Management</h1>
          <p className="text-gray-600">Create and manage price units for different job types</p>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Price Unit
        </Button>   
      </div>

      {/* Create New Price Unit Form */}
      {isCreating && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Price Unit</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={handleCreateUnit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Price Unit Name</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="e.g., Standard Document Processing"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <Select name="currency" defaultValue="AUD">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AUD">AUD</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  name="description"
                  placeholder="Brief description of what this covers..."
                  required
                />
              </div>

              <div>
                <Label htmlFor="amount">Price Amount</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="amount"
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="35.00"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit">Create Price Unit</Button>
                <Button type="button" variant="outline" onClick={() => setIsCreating(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Price Units List */}
      <div className="space-y-4">
        {priceUnits.map((unit) => (
          <Card key={unit._id}>
            <CardContent className="p-6">
              {editingUnit === unit._id ? (
                <form action={(formData) => handleUpdateUnit(formData, unit._id)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`edit-name-${unit._id}`}>Price Unit Name</Label>
                      <Input
                        id={`edit-name-${unit._id}`}
                        name="name"
                        defaultValue={unit.name}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor={`edit-currency-${unit._id}`}>Currency</Label>
                      <Select name="currency" defaultValue={unit.currency}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AUD">AUD</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="GBP">GBP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor={`edit-description-${unit._id}`}>Description</Label>
                    <Input
                      id={`edit-description-${unit._id}`}
                      name="description"
                      defaultValue={unit.description}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`edit-amount-${unit._id}`}>Price Amount</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id={`edit-amount-${unit._id}`}
                          name="amount"
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={(unit.amount / 100).toFixed(2)}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor={`edit-status-${unit._id}`}>Status</Label>
                      <Select name="isActive" defaultValue={unit.isActive.toString()}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Active</SelectItem>
                          <SelectItem value="false">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit">Update</Button>
                    <Button type="button" variant="outline" onClick={() => setEditingUnit(null)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{unit.name}</h3>
                      <Badge variant={unit.isActive ? "default" : "secondary"}>
                        {unit.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-gray-600 mb-2">{unit.description}</p>
                    <p className="text-2xl font-bold text-green-600">
                      {unit.currency} ${(unit.amount / 100).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setEditingUnit(unit._id)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDeleteUnit(unit._id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        
        {priceUnits.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-gray-500 mb-4">No price units created yet.</p>
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Price Unit
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function CommissionSettingsView() {
  const [compilerCommission, setCompilerCommission] = useState(70);
  const [companyCommission, setCompanyCommission] = useState(30);
  const [isSaving, setIsSaving] = useState(false);
  
  const commissionSettings = useQuery(api.systemSettings.getCommissionSettings);
  const updateCommissionSetting = useMutation(api.systemSettings.updateCommissionSetting);
  const initializeSettings = useMutation(api.systemSettings.initializeDefaultSettings);

  // Update local state when settings are loaded
  React.useEffect(() => {
    if (commissionSettings) {
      setCompilerCommission(commissionSettings.compilerCommission || 70);
      setCompanyCommission(commissionSettings.companyCommission || 30);
    }
  }, [commissionSettings]);

  const handleSaveSettings = async () => {
    if (compilerCommission + companyCommission !== 100) {
      alert("Commission percentages must add up to 100%");
      return;
    }

    setIsSaving(true);
    try {
      await updateCommissionSetting({
        key: "compilerCommission",
        value: compilerCommission,
        description: "Percentage of job price that goes to the compiler"
      });
      
      await updateCommissionSetting({
        key: "companyCommission",
        value: companyCommission,
        description: "Percentage of job price that goes to the company"
      });
      
      alert("Commission settings updated successfully!");
    } catch (error) {
      alert("Failed to update commission settings");
    }
    setIsSaving(false);
  };

  const handleInitializeDefaults = async () => {
    try {
      await initializeSettings();
      alert("Default settings initialized!");
    } catch (error) {
      alert("Failed to initialize settings");
    }
  };

  if (commissionSettings === undefined) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Commission Settings</h1>
          <p className="text-gray-600">Manage how revenue is split between compilers and the company</p>
        </div>
        <Button onClick={handleInitializeDefaults} variant="outline">
          Reset to Defaults
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue Split Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="compilerCommission">Compiler Commission (%)</Label>
              <Input
                id="compilerCommission"
                type="number"
                min="0"
                max="100"
                value={compilerCommission}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 0;
                  setCompilerCommission(value);
                  setCompanyCommission(100 - value);
                }}
              />
              <p className="text-sm text-gray-500 mt-1">
                Percentage of each job payment that goes to the compiler
              </p>
            </div>

            <div>
              <Label htmlFor="companyCommission">Company Commission (%)</Label>
              <Input
                id="companyCommission"
                type="number"
                min="0"
                max="100"
                value={companyCommission}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 0;
                  setCompanyCommission(value);
                  setCompilerCommission(100 - value);
                }}
              />
              <p className="text-sm text-gray-500 mt-1">
                Percentage of each job payment that goes to the company
              </p>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Commission Split Preview</h4>
            <div className="text-sm text-gray-600">
              <p>For a $35.00 job:</p>
              <p>• Compiler receives: ${((3500 * compilerCommission) / 10000).toFixed(2)}</p>
              <p>• Company receives: ${((3500 * companyCommission) / 10000).toFixed(2)}</p>
              <p className={`mt-2 ${compilerCommission + companyCommission === 100 ? 'text-green-600' : 'text-red-600'}`}>
                Total: {compilerCommission + companyCommission}% 
                {compilerCommission + companyCommission !== 100 && " (Must equal 100%)"}
              </p>
            </div>
          </div>

          <Button 
            onClick={handleSaveSettings} 
            disabled={isSaving || compilerCommission + companyCommission !== 100}
            className="w-full"
          >
            {isSaving ? "Saving..." : "Save Commission Settings"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Important Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>• Commission rates apply to all new jobs going forward</li>
            <li>• Existing jobs maintain their original commission structure</li>
            <li>• Compilers only see their portion of the job price when browsing available jobs</li>
            <li>• Revenue is only calculated when jobs are marked as completed</li>
            <li>• Changes take effect immediately after saving</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function ProcessingSettingsView() {
  const [isSaving, setIsSaving] = useState(false);
  
  const processingMode = useQuery(api.systemSettings.getJobProcessingMode);
  const updateProcessingMode = useMutation(api.systemSettings.updateJobProcessingMode);
  const initializeSettings = useMutation(api.systemSettings.initializeDefaultSettings);

  const handleUpdateMode = async (mode: "auto-process" | "require-human-review") => {
    setIsSaving(true);
    try {
      await updateProcessingMode({ mode });
      alert("Processing mode updated successfully!");
    } catch (error) {
      alert("Failed to update processing mode");
    }
    setIsSaving(false);
  };

  const handleInitializeDefaults = async () => {
    try {
      await initializeSettings();
      alert("Default settings initialized!");
    } catch (error) {
      alert("Failed to initialize settings");
    }
  };

  if (processingMode === undefined) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Job Processing Settings</h1>
          <p className="text-gray-600">Configure how jobs are processed after AI extraction</p>
        </div>
        <Button onClick={handleInitializeDefaults} variant="outline">
          Reset to Defaults
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Processing Mode Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Current Mode: {processingMode === "auto-process" ? "Auto-Process" : "Require Human Review"}</h4>
              <p className="text-sm text-gray-600 mb-4">
                {processingMode === "auto-process" 
                  ? "Jobs with matching templates will be automatically completed after AI extraction."
                  : "Jobs will require human review even after successful AI extraction."
                }
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className={`cursor-pointer border-2 ${processingMode === "auto-process" ? "border-blue-500 bg-blue-50" : "border-gray-200"}`}>
                <CardContent className="p-4" onClick={() => handleUpdateMode("auto-process")}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-3 h-3 rounded-full ${processingMode === "auto-process" ? "bg-blue-500" : "bg-gray-300"}`}></div>
                    <h4 className="font-medium">Auto-Process</h4>
                  </div>
                  <p className="text-sm text-gray-600">
                    Jobs with high-confidence template matches will be automatically completed without human intervention.
                  </p>
                  <ul className="text-xs text-gray-500 mt-2 space-y-1">
                    <li>• Faster job completion</li>
                    <li>• Reduced manual work for compilers</li>
                    <li>• Best for trusted templates with high accuracy</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className={`cursor-pointer border-2 ${processingMode === "require-human-review" ? "border-blue-500 bg-blue-50" : "border-gray-200"}`}>
                <CardContent className="p-4" onClick={() => handleUpdateMode("require-human-review")}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-3 h-3 rounded-full ${processingMode === "require-human-review" ? "bg-blue-500" : "bg-gray-300"}`}></div>
                    <h4 className="font-medium">Require Human Review</h4>
                  </div>
                  <p className="text-sm text-gray-600">
                    All jobs will require compiler review and approval before completion, even after AI extraction.
                  </p>
                  <ul className="text-xs text-gray-500 mt-2 space-y-1">
                    <li>• Quality assurance through human verification</li>
                    <li>• Ability to edit and correct extracted data</li>
                    <li>• Consistent oversight for all jobs</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>

          {isSaving && (
            <div className="text-center py-4">
              <p className="text-gray-600">Updating processing mode...</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-700">Auto-Process Mode</h4>
              <ol className="text-sm text-gray-600 space-y-1 mt-2 pl-4">
                <li>1. Job is created and auto-processing begins</li>
                <li>2. AI extracts supplier name and searches for matching template</li>
                <li>3. If high-confidence template found (≥95% match):</li>
                <li className="pl-4">• AI extracts data using template</li>
                <li className="pl-4">• Job is automatically marked as completed</li>
                <li>4. If no template found, job goes to compiler queue</li>
              </ol>
            </div>
            <div>
              <h4 className="font-medium text-gray-700">Require Human Review Mode</h4>
              <ol className="text-sm text-gray-600 space-y-1 mt-2 pl-4">
                <li>1. Job is created and auto-processing begins</li>
                <li>2. AI extracts supplier name and searches for matching template</li>
                <li>3. If high-confidence template found (≥95% match):</li>
                <li className="pl-4">• AI extracts data using template</li>
                <li className="pl-4">• Job is marked as IN_PROGRESS for compiler review</li>
                <li>4. If no template found, job stays as RECEIVED for compiler pickup</li>
                <li>5. Compiler reviews, edits if needed, and marks complete</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}