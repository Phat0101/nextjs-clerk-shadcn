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
  const stats = useQuery(api.myFunctions.getDashboardStats);
  const acceptJobMutation = useMutation(api.jobs.acceptJob);
  const router = useRouter();

  const jobPath = (jobId: string, jobType?: "INVOICE"|"SHIPMENT"|"N10") => {
    return `/jobs/${jobId}/${jobType === "SHIPMENT" ? "shipment" : jobType === "N10" ? "n10" : "invoice"}`;
  };

  const handleAcceptJob = async (job: { _id: string; jobType?: "INVOICE"|"SHIPMENT"|"N10"; }) => {
    try {
      await acceptJobMutation({ jobId: job._id as Id<"jobs"> });
      router.push(jobPath(job._id, job.jobType));
    } catch (err) {
      console.error("Failed to accept job", err);
      alert("Failed to accept job. Please try again.");
    }
  };

  if (availableJobs === undefined || myActiveJobs === undefined) {
    return <div className="p-6">Loading...</div>;
  }

  if (currentView === "available-jobs") {
    return <AvailableJobsView availableJobs={availableJobs} onAccept={handleAcceptJob} />;
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

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Available Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.availableJobs}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Active Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.activeJobs}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.completedJobs}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Earned</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">
                ${((stats.totalEarned || 0) / 100).toFixed(2)}
              </div>
            </CardContent>
          </Card>
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
            {availableJobs.slice(0, 3).map((job) => (
              <div key={job._id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <h3 className="font-medium">{job.title}</h3>
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
                >
                  Accept Job
                </Button>
              </div>
            ))}
            {availableJobs.length === 0 && (
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
            {myActiveJobs.slice(0, 3).map((job) => (
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
  onAccept
}: {
  availableJobs: Array<{
    _id: string;
    title: string;
    totalPrice: number;
    compilerPrice: number;
    deadline: number;
    status: string;
    jobType?: "INVOICE"|"SHIPMENT"|"N10";
  }>;
  onAccept: (job: { _id: string; jobType?: "INVOICE"|"SHIPMENT"|"N10"; }) => void;
}) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Available Jobs</h1>
      <div className="grid gap-4">
        {availableJobs.map((job) => (
          <Card key={job._id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{job.title}</h3>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      ${(job.compilerPrice / 100).toFixed(2)}
                    </p>
                    <TimeRemaining deadline={job.deadline} />
                  </div>
                </div>
                <Button
                  onClick={() => onAccept(job)}
                >
                  Accept Job
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {availableJobs.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-gray-500">No available jobs at the moment.</p>
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
    jobType?: "INVOICE"|"SHIPMENT"|"N10";
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