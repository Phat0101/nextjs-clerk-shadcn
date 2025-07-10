"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import React from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, ChevronUp, ChevronDown, User, Clock } from "lucide-react";
import TimeRemaining from "@/components/TimeRemaining";
import FinishedJobsView from "./FinishedJobsView";
import {
  KanbanProvider,
  KanbanBoard,
  KanbanHeader,
} from "@/components/ui/kibo-ui/kanban";

interface ClientViewProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

export default function ClientView({ currentView, onViewChange }: ClientViewProps) {
  const jobs = useQuery(api.jobs.getForClient);
  const stats = useQuery(api.myFunctions.getDashboardStats);
  const router = useRouter();

  if (jobs === undefined) {
    return <div className="p-6">Loading...</div>;
  }

  if (currentView === "create-job") {
    return <CreateJobView onViewChange={onViewChange} />;
  }

  if (currentView === "my-jobs") {
    return <MyJobsView jobs={jobs} />;
  }

  if (currentView === "finished-jobs") {
    return <FinishedJobsView />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Client Dashboard</h1>
          <p className="text-gray-600">Manage your document processing jobs</p>
        </div>
        <Button onClick={() => { onViewChange("create-job"); router.push('/jobs/create'); }}>
          <Plus className="w-4 h-4 mr-2" />
          Create Job
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="space-y-6">
          {/* Main KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Jobs Done</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.completedJobs}</div>
                <p className="text-xs text-gray-500">Completed successfully</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Spent</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  ${((stats.totalCost || 0) / 100).toFixed(2)}
                </div>
                <p className="text-xs text-gray-500">On completed jobs</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Average Cost</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  ${((stats.averageCost || 0) / 100).toFixed(2)}
                </div>
                <p className="text-xs text-gray-500">Per job</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Avg. Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {(stats.averageCompletionTime ?? 0).toFixed(1)}h
                </div>
                <p className="text-xs text-gray-500">To completion</p>
              </CardContent>
            </Card>
          </div>

          {/* Status Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Pending</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-orange-500">{stats.pendingJobs}</div>
                <p className="text-xs text-gray-500">Waiting for compiler</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">In Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-blue-500">{stats.inProgressJobs}</div>
                <p className="text-xs text-gray-500">Being processed</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Jobs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-gray-700">{stats.totalJobs}</div>
                <p className="text-xs text-gray-500">All time</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Recent Jobs */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Recent Jobs</CardTitle>
            <Button variant="outline" onClick={() => onViewChange("my-jobs")}>
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {jobs.slice(0, 5).map((job: any) => (
              <div key={job._id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <div>
                    <h3 className="font-medium">{job.title}</h3>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-gray-500">${(job.totalPrice / 100).toFixed(2)}</p>
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
                    {job.compilerName && (job.status === "IN_PROGRESS" || job.status === "COMPLETED") && (
                      <div className="text-xs text-blue-600">
                        Compiler: {job.compilerName}
                      </div>
                    )}
                  </div>
                </div>
                <Badge 
                  variant={
                    job.status === "COMPLETED" ? "default" : 
                    job.status === "IN_PROGRESS" ? "secondary" : "outline"
                  }
                >
                  {job.status.replace("_", " ")}
                </Badge>
              </div>
            ))}
            {jobs.length === 0 && (
              <p className="text-center text-gray-500 py-8">
                No jobs yet. Create your first job to get started!
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CreateJobView({ onViewChange }: { onViewChange: (view: string) => void }) {
  const router = useRouter();
  
  React.useEffect(() => {
    router.push('/jobs/create');
  }, [router]);

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="outline" onClick={() => onViewChange("dashboard")}>
          ← Back
        </Button>
        <h1 className="text-2xl font-bold">Create New Job</h1>
      </div>
      <p>Redirecting to job creation form...</p>
    </div>
  );
}

function MyJobsView({ jobs }: { jobs: Array<{
  _id: string;
  title: string;
  totalPrice: number;
  status: string;
  outputFileUrl?: string;
  deadline: number;
  compilerName?: string | null;
}> }) {
  const [expandedJob, setExpandedJob] = React.useState<string | null>(null);
  
  // Group jobs by status
  const receivedJobs = jobs.filter(job => job.status === "RECEIVED");
  const inProgressJobs = jobs.filter(job => job.status === "IN_PROGRESS");
  const completedJobs = jobs.filter(job => job.status === "COMPLETED");

  // Transform jobs into kanban format
  const kanbanJobs = jobs.map((job: any) => ({
    id: job._id,
    name: job.title,
    column: job.status,
    ...job,
  }));

  const columns = [
    {
      id: "RECEIVED",
      name: "Received",
      count: receivedJobs.length,
      color: "bg-orange-500",
    },
    {
      id: "IN_PROGRESS",
      name: "In Progress",
      count: inProgressJobs.length,
      color: "bg-blue-500",
    },
    {
      id: "COMPLETED",
      name: "Completed",
      count: completedJobs.length,
      color: "bg-green-500",
    },
  ];

  const JobCard = ({ job, isExpanded, onToggle }: { 
    job: any;
    isExpanded: boolean;
    onToggle: () => void;
  }) => {
    const jobFiles = useQuery(api.jobs.getJobFiles, { jobId: job.id as any });
    
    return (
      <Card className="cursor-pointer hover:shadow-md transition-all duration-200 mb-2 p-0">
        <CardContent className="p-4">
          <div 
            className="space-y-3"
            onClick={onToggle}
          >
            {/* Job Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm text-gray-900 truncate mb-1">
                  {job.title}
                </h3>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1 max-w-40 truncate" title={`Job ID: ${job.id}`}>
                    <FileText className="w-3 h-3" />
                    #{job.id}
                  </span>
                  <span className="font-medium text-gray-900">
                    ${(job.totalPrice / 100).toFixed(0)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {isExpanded ? (
                  <ChevronUp className="w-3 h-3 text-gray-400" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-gray-400" />
                )}
              </div>
            </div>

            {/* Job Meta */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                {job.compilerName && (
                  <span className="flex items-center gap-1 text-gray-600">
                    <User className="w-3 h-3" />
                    {job.compilerName}
                  </span>
                )}
                <span className="text-gray-500">
                  {new Date(job._creationTime || Date.now()).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-gray-400" />
                {job.status === "COMPLETED" && job.completedAt ? (
                  (() => {
                    const taken = Math.round((job.completedAt - (job._creationTime || 0)) / 60000);
                    const allowed = Math.round((job.deadline - (job._creationTime || 0)) / 60000);
                    const onTime = taken <= allowed;
                    return (
                      <span className={`text-xs font-medium ${onTime ? 'text-green-600' : 'text-orange-600'}`}>
                        {taken} min
                      </span>
                    );
                  })()
                ) : (
                  <TimeRemaining deadline={job.deadline} compact />
                )}
              </div>
            </div>

            {/* Progress Bar */}
            {job.compilerStep && job.status !== 'COMPLETED' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-600 capitalize">{job.compilerStep}</span>
                  <span className="text-xs text-gray-500">
                    {Math.round((stepOrder[job.compilerStep] ?? 0) / 5 * 100)}%
                  </span>
                </div>
                <ProgressBar step={job.compilerStep} />
              </div>
            )}

            {/* Expanded Details */}
            {isExpanded && (
              <div className="pt-3 border-t border-gray-200 space-y-3">
                {jobFiles && jobFiles.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-700 mb-2">
                      Files ({jobFiles.length})
                    </h4>
                    <div className="space-y-1">
                      {jobFiles.map((file: any) => (
                        <button
                          key={file._id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (file.fileUrl) {
                              window.open(file.fileUrl, '_blank');
                            }
                          }}
                          className="w-full text-left p-2 text-xs bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-blue-600 hover:text-blue-800 truncate">
                              {file.fileName}
                            </span>
                            {file.fileSize && (
                              <span className="text-gray-500 text-xs ml-2">
                                {(file.fileSize / 1024 / 1024).toFixed(1)} MB
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Download Results Button for Completed Jobs */}
                {job.status === "COMPLETED" && job.outputFileUrl && (
                  <div className="border-t pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-7 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(job.outputFileUrl, '_blank');
                      }}
                    >
                      Download Results (CSV)
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

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
      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
        <div
          className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    );
  };

  return (
    <div className="p-4 py-2 h-screen flex flex-col">
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">My Jobs</h1>

      {/* Kanban Board */}
      <div className="flex-1 overflow-hidden">
        <KanbanProvider
          columns={columns}
          data={kanbanJobs}
          className="h-full"
        >
          {(column) => (
            <KanbanBoard key={column.id} id={column.id} className="h-full">
              <KanbanHeader className="flex items-center justify-between p-4 bg-gray-50 border-b">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${column.color}`} />
                  <h3 className="font-medium text-sm text-gray-900">{column.name}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {column.count}
                  </Badge>
                </div>
              </KanbanHeader>
              <div className="p-4 flex-1 overflow-y-auto">
                {kanbanJobs.filter(job => job.column === column.id).length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-sm">No jobs in this column</p>
                  </div>
                ) : (
                  kanbanJobs.filter(job => job.column === column.id).map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      isExpanded={expandedJob === job.id}
                      onToggle={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                    />
                  ))
                )}
              </div>
            </KanbanBoard>
          )}
        </KanbanProvider>
      </div>
    </div>
  );
} 