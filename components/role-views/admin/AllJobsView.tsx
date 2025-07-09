/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Edit, Trash2 } from "lucide-react";
import TimeRemaining from "@/components/TimeRemaining";

export default function AllJobsView() {
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