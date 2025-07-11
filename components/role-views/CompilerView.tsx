"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Briefcase, CheckSquare, DollarSign } from "lucide-react";
import TimeRemaining from "@/components/TimeRemaining";
import CompletedJobsView from "./CompletedJobsView";

interface CompilerViewProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

export default function CompilerView({ currentView, onViewChange }: CompilerViewProps) {
  const availableJobs = useQuery(api.jobs.getAvailable);
  const myActiveJobs = useQuery(api.jobs.getMyActive);
  const reviewJobs = useQuery(api.jobs.getJobsReadyForReview);
  const stats = useQuery(api.myFunctions.getDashboardStats);
  const acceptJobMutation = useMutation(api.jobs.acceptJob);
  const acceptReviewJobMutation = useMutation(api.jobs.acceptReviewJob);
  const router = useRouter();

  const jobPath = (jobId: string, jobType?: "INVOICE" | "SHIPMENT" | "N10") => {
    return `/jobs/${jobId}/${jobType === "SHIPMENT" ? "shipment" : jobType === "N10" ? "n10" : "invoice"}`;
  };

  const handleAcceptJob = async (job: { _id: string; jobType?: "INVOICE" | "SHIPMENT" | "N10"; }) => {
    try {
      await acceptJobMutation({ jobId: job._id as Id<"jobs"> });
      router.push(jobPath(job._id, job.jobType));
    } catch (err) {
      console.error("Failed to accept job", err);
      alert("Failed to accept job. Please try again.");
    }
  };

  const handleAcceptReviewJob = async (job: { _id: string; jobType?: "INVOICE" | "SHIPMENT" | "N10"; }) => {
    try {
      await acceptReviewJobMutation({ jobId: job._id as Id<"jobs"> });
      router.push(jobPath(job._id, job.jobType));
    } catch (err) {
      console.error("Failed to accept review job", err);
      alert("Failed to accept review job. Please try again.");
    }
  };

  if (availableJobs === undefined || myActiveJobs === undefined || reviewJobs === undefined) {
    return <div className="p-6">Loading...</div>;
  }

  if (currentView === "available-jobs") {
    return <AvailableJobsView availableJobs={availableJobs} reviewJobs={reviewJobs} onAccept={handleAcceptJob} onAcceptReview={handleAcceptReviewJob} />;
  }

  if (currentView === "active-jobs") {
    return <ActiveJobsView activeJobs={myActiveJobs} router={router} />;
  }

  if (currentView === "completed-jobs") {
    return <CompletedJobsView />;
  }

  // Dashboard view
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compiler Dashboard</h1>
          <p className="text-gray-600">Find and complete data extraction jobs</p>
        </div>
      </div>

      {/* Stats Table */}
      {stats && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Available Jobs</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Review Jobs</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Active Jobs</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Completed</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Total Earned</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-gray-200">
                <td className="px-4 py-4">
              <div className="text-2xl font-bold text-blue-600">{stats.availableJobs}</div>
                  <p className="text-xs text-gray-500 mt-1">No template found</p>
                </td>
                <td className="px-4 py-4">
                  <div className="text-2xl font-bold text-purple-600">{reviewJobs?.length || 0}</div>
                  <p className="text-xs text-gray-500 mt-1">AI extracted</p>
                </td>
                <td className="px-4 py-4">
              <div className="text-2xl font-bold text-orange-600">{stats.activeJobs}</div>
                  <p className="text-xs text-gray-500 mt-1">In progress</p>
                </td>
                <td className="px-4 py-4">
              <div className="text-2xl font-bold text-green-600">{stats.completedJobs}</div>
                </td>
                <td className="px-4 py-4">
              <div className="text-2xl font-bold text-green-700">
                ${((stats.totalEarned || 0) / 100).toFixed(2)}
              </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Available Jobs Section */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5" />
              Available Jobs
            </CardTitle>
            <Button variant="outline" onClick={() => onViewChange("available-jobs")}>
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Show review jobs first with purple styling */}
            {reviewJobs.slice(0, 2).map((job: any) => (
              <div key={job._id} className="flex items-center justify-between p-3 border rounded-lg border-purple-200 bg-purple-50">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium">{job.title}</h3>
                    <Badge variant="default" className="bg-purple-100 text-purple-800 text-xs">AI Extracted</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      ${(job.totalPrice / 100).toFixed(2)}
                    </p>
                    <TimeRemaining deadline={job.deadline} />
                    {job.supplierName && (
                      <Badge variant="outline" className="text-xs">{job.supplierName}</Badge>
                    )}
                  </div>
                </div>
                <Button
                  onClick={() => handleAcceptReviewJob(job)}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Review & Edit
                </Button>
              </div>
            ))}
            
            {/* Show manual work jobs with blue styling */}
            {availableJobs.slice(0, reviewJobs.length >= 2 ? 1 : 3).map((job: any) => (
              <div key={job._id} className="flex items-center justify-between p-3 border rounded-lg border-blue-200 bg-blue-50">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium">{job.title}</h3>
                    <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700">Manual Work</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      ${(job.compilerPrice / 100).toFixed(2)}
                    </p>
                    <TimeRemaining deadline={job.deadline} />
                  </div>
                </div>
                <Button
                  onClick={() => handleAcceptJob(job)}
                  size="sm"
                  variant="outline"
                  className="border-blue-300 text-blue-700 hover:bg-blue-100"
                >
                  Accept Job
                </Button>
              </div>
            ))}
            
            {availableJobs.length === 0 && reviewJobs.length === 0 && (
              <p className="text-center text-gray-500 py-8">
                No available jobs at the moment. Check back later!
              </p>
            )}
          </div>
        </CardContent>
      </Card>



      {/* Active Jobs Section */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5" />
              Your Active Jobs
            </CardTitle>
            <Button variant="outline" onClick={() => onViewChange("active-jobs")}>
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {myActiveJobs.slice(0, 3).map((job: any) => (
              <div key={job._id} className="grid items-center gap-3 p-3 border rounded-lg grid-cols-6">
                <h3 className="font-medium col-span-2 truncate">{job.title}</h3>
                <Badge variant="secondary">In Progress</Badge>
                <span className="text-sm text-gray-500">${(job.totalPrice / 100).toFixed(2)}</span>
                <TimeRemaining deadline={job.deadline} />
                <Button onClick={() => {
                  const seg = (job as any).jobType === "SHIPMENT" ? "shipment" : (job as any).jobType === "N10" ? "n10" : "invoice";
                  router.push(`/jobs/${job._id}/${seg}`);
                }} size="sm">
                  Continue Work
                </Button>
              </div>
            ))}
            {myActiveJobs.length === 0 && (
              <p className="text-center text-gray-500 py-8">
                No active jobs. Accept an available job to get started!
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AvailableJobsView({
  availableJobs,
  reviewJobs,
  onAccept,
  onAcceptReview
}: {
  availableJobs: Array<{
    _id: string;
    title: string;
    totalPrice: number;
    compilerPrice: number;
    deadline: number;
    status: string;
    jobType?: "INVOICE" | "SHIPMENT" | "N10";
  }>;
  reviewJobs: Array<any>;
  onAccept: (job: { _id: string; jobType?: "INVOICE" | "SHIPMENT" | "N10"; }) => void;
  onAcceptReview: (job: { _id: string; jobType?: "INVOICE" | "SHIPMENT" | "N10"; }) => void;
}) {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Available Jobs</h1>
      </div>
      
      <div className="space-y-6">
        {/* Review Jobs Section */}
        {reviewJobs.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold text-purple-700">Jobs Ready for Review</h2>
              <Badge variant="default" className="bg-purple-100 text-purple-800">AI Extracted</Badge>
            </div>
            <div className="grid gap-4">
              {reviewJobs.map((job: any) => (
                <Card key={job._id} className="border-purple-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium">{job.title}</h3>
                          <Badge variant="default" className="bg-purple-100 text-purple-800 text-xs">AI Extracted</Badge>
                          {job.supplierName && (
                            <Badge variant="outline" className="text-xs">{job.supplierName}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            ${(job.totalPrice / 100).toFixed(2)}
                          </div>
                          <TimeRemaining deadline={job.deadline} />
                          <span>Template: {job.templateFound ? 'Found' : 'None'}</span>
                        </div>
                        <p className="text-xs text-purple-600 mt-1">Ready for review and editing before completion</p>
                      </div>
                      <Button
                        onClick={() => onAcceptReview(job)}
                        variant="default"
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        Review & Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Manual Work Jobs Section */}
        {availableJobs.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold text-blue-700">Jobs Requiring Manual Work</h2>
              <Badge variant="outline" className="bg-blue-50 text-blue-700">No Template</Badge>
            </div>
            <div className="grid gap-4">
              {availableJobs.map((job) => (
                <Card key={job._id} className="border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium">{job.title}</h3>
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">Manual Work</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-gray-500 flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            ${(job.compilerPrice / 100).toFixed(2)}
                          </p>
                          <TimeRemaining deadline={job.deadline} />
                        </div>
                        <p className="text-xs text-blue-600 mt-1">Requires manual data extraction from scratch</p>
                      </div>
                      <Button
                        onClick={() => onAccept(job)}
                        variant="outline"
                        className="border-blue-300 text-blue-700 hover:bg-blue-50"
                      >
                        Accept Job
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* No Jobs Available */}
        {availableJobs.length === 0 && reviewJobs.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="flex flex-col items-center gap-4">
                <Briefcase className="w-12 h-12 text-gray-400" />
                <div>
                  <p className="text-gray-500 mb-2">No jobs available at the moment</p>
                  <p className="text-sm text-gray-400">Check back later for new jobs</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function ActiveJobsView({
  activeJobs,
  router
}: {
  activeJobs: Array<{
    _id: string;
    title: string;
    totalPrice: number;
    deadline: number;
    status: string;
    jobType?: "INVOICE" | "SHIPMENT" | "N10";
  }>;
  router: any;
}) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Active Jobs</h1>
      <div className="grid gap-4">
        {activeJobs.map((job) => (
          <Card key={job._id} className="p-0">
            <CardContent className="p-4">
              <div className="grid items-center grid-cols-9">
                <h3 className="font-medium col-span-5 truncate">{job.title}</h3>
                <Badge variant="secondary">In Progress</Badge>
                <span className="text-sm text-gray-500">${(job.totalPrice / 100).toFixed(2)}</span>
                <TimeRemaining deadline={job.deadline} />
                <Button onClick={() => {
                  const seg = (job as any).jobType === "SHIPMENT" ? "shipment" : (job as any).jobType === "N10" ? "n10" : "invoice";
                  router.push(`/jobs/${job._id}/${seg}`);
                }} size="sm">
                  Continue Work
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {activeJobs.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-gray-500">No active jobs. Accept an available job to get started!</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

