/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Edit, Trash2, Clock, User } from "lucide-react";
import TimeRemaining from "@/components/TimeRemaining";
import {
  KanbanProvider,
  KanbanBoard,
  KanbanHeader,
} from "@/components/ui/kibo-ui/kanban";

type KanbanJob = {
  id: string;
  name: string;
  column: string;
  [key: string]: any;
};

type KanbanColumn = {
  id: string;
  name: string;
  count: number;
  color: string;
};

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
      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
        <div
          className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
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
      <div className="p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">All Jobs Management</h1>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading jobs...</p>
          </div>
        </div>
      </div>
    );
  }

  // Transform jobs into kanban format
  const kanbanJobs: KanbanJob[] = allJobs.map((job: any) => ({
    id: job._id,
    name: job.title,
    column: job.status,
    ...job,
  }));

  const columns: KanbanColumn[] = [
    {
      id: "RECEIVED",
      name: "Received",
      count: kanbanJobs.filter(job => job.column === "RECEIVED").length,
      color: "bg-orange-500",
    },
    {
      id: "IN_PROGRESS",
      name: "In Progress",
      count: kanbanJobs.filter(job => job.column === "IN_PROGRESS").length,
      color: "bg-blue-500",
    },
    {
      id: "COMPLETED",
      name: "Completed",
      count: kanbanJobs.filter(job => job.column === "COMPLETED").length,
      color: "bg-green-500",
    },
  ];

  const JobCard = ({ job }: { job: KanbanJob }) => {
    const jobFiles = useQuery(api.jobs.getJobFiles, { jobId: job.id as any });
    const isExpanded = expandedJob === job.id;

    return (
      <Card className="cursor-pointer hover:shadow-md transition-all duration-200 mb-2 p-0">
        <CardContent className="p-4">
          <div
            className="space-y-3"
            onClick={() => setExpandedJob(isExpanded ? null : job.id)}
          >
            {/* Job Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm text-gray-900 truncate mb-1">
                  {job.title}
                </h3>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1 max-w-40 truncate" title={`Job ID: ${job.id}`}>
                    #{job.id}
                  </span>
                  <span className="font-medium text-gray-900">
                    ${(job.totalPrice / 100).toFixed(0)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingDeadline(job.id);
                    setNewDeadlineHours(job.deadlineHours);
                  }}
                >
                  <Edit className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteJob(job.id);
                  }}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {/* Deadline Editor - Show when editing */}
            {editingDeadline === job.id && (
              <div className="p-3 bg-gray-50 rounded-md" onClick={(e) => e.stopPropagation()}>
                <h4 className="text-xs font-medium text-gray-700 mb-2">Update Deadline</h4>
                <div className="flex items-center gap-2">
                  <Select
                    value={newDeadlineHours.toString()}
                    onValueChange={(value) => setNewDeadlineHours(Number(value))}
                  >
                    <SelectTrigger className="h-8 text-xs flex-1">
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
                    className="h-8 px-3 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpdateDeadline(job.id);
                    }}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-3 text-xs"
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
                  {new Date(job._creationTime).toLocaleDateString()}
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

  return (
    <div className="p-4 py-2 h-screen flex flex-col">
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">All Jobs Management</h1>

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
                    <JobCard key={job.id} job={job} />
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