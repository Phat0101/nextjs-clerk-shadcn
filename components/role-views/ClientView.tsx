"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import React from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, ChevronUp, ChevronDown } from "lucide-react";
import TimeRemaining from "@/components/TimeRemaining";
import FinishedJobsView from "./FinishedJobsView";

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
            {jobs.slice(0, 5).map((job) => (
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

  const JobCard = ({ job, isExpanded, onToggle }: { 
    job: {
      _id: string;
      title: string;
      totalPrice: number;
      status: string;
      outputFileUrl?: string;
      deadline: number;
      _creationTime?: number;
      compilerName?: string | null;
      compilerStep?: string | null;
      completedAt?: number;
    };
    isExpanded: boolean;
    onToggle: () => void;
  }) => {
    const jobFiles = useQuery(api.jobs.getJobFiles, { jobId: job._id as any });
    
    if (isExpanded) {
      return (
        <Card key={job._id} className="mb-2 cursor-pointer p-0"  onClick={onToggle}>
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
                <ChevronUp className="w-3 h-3 text-gray-400 flex-shrink-0" />
              </div>
              
              {/* Detailed Information */}
              <div className="space-y-1 text-xs text-gray-600 border-t pt-2">
                <div>ID: #{job._id.slice(-6)}</div>
                {job.status === "COMPLETED" && job.completedAt && (
                  <div>Time Taken: {Math.round((job.completedAt - (job._creationTime||0))/(1000*60))} min</div>
                )}
                <div>Created: {new Date(job._creationTime || Date.now()).toLocaleDateString()}</div>
                {jobFiles && jobFiles.length > 0 && (
                  <div>
                    <div className="font-medium text-gray-700 mb-1">Files ({jobFiles.length}):</div>
                    <div className="space-y-1 pl-2">
                      {jobFiles.map((file) => (
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

              {/* Download button for completed jobs */}
              {job.status === "COMPLETED" && job.outputFileUrl && (
                <div className="border-t pt-2" onClick={(e) => e.stopPropagation()}>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full h-7 text-xs" 
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(job.outputFileUrl, '_blank');
                    }}
                  >
                    Download Results
                  </Button>
                </div>
              )}

              {/* Progress Bar */}
              {job.compilerStep && job.status !== 'COMPLETED' && (
                <div className="w-full mt-1">
                  <ProgressBar step={job.compilerStep} />
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
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </div>
        </div>
        {job.compilerStep && job.status !== 'COMPLETED' && (
          <div className="w-full mt-1">
            <ProgressBar step={job.compilerStep} />
          </div>
        )}
      </div>
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
      <div className="h-1 bg-gray-200 rounded overflow-hidden">
        <div className="bg-blue-600 h-full" style={{ width: `${percent}%` }}></div>
      </div>
    );
  };

  return (
    <div className="p-4 space-y-2">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Jobs</h1>
        <p className="text-gray-600">Track the progress of your document processing jobs</p>
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
                <p className="text-gray-500 text-sm">No jobs waiting to be picked up</p>
              </div>
            ) : (
              receivedJobs.map((job) => (
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
                <p className="text-gray-500 text-sm">No jobs currently being processed</p>
              </div>
            ) : (
              inProgressJobs.map((job) => (
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
                <p className="text-gray-500 text-sm">No completed jobs yet</p>
              </div>
            ) : (
              completedJobs.map((job) => (
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