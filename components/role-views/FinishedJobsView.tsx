"use client";

import React, { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Download } from "lucide-react";

export default function FinishedJobsView() {
  const jobs = useQuery(api.jobs.getForClient);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  if (jobs === undefined) {
    return <div className="p-6">Loading...</div>;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const completedJobs = jobs.filter((j: any) => j.status === "COMPLETED");

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Finished Jobs</h1>
      {completedJobs.length === 0 && (
        <p className="text-gray-500">No finished jobs yet.</p>
      )}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {completedJobs.map((job: any) => (
        <FinishedJobCard
          key={job._id}
          job={job}
          expanded={expandedJob === job._id}
          onToggle={() =>
            setExpandedJob(expandedJob === job._id ? null : job._id)
          }
        />
      ))}
    </div>
  );
}

function FinishedJobCard({
  job,
  expanded,
  onToggle,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  job: any;
  expanded: boolean;
  onToggle: () => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const output = useQuery(api.jobs.getJobOutput, { jobId: job._id as any });

  const downloadCsv = () => {
    if (!output?.csvUrl) return;
    window.open(output.csvUrl, "_blank");
  };

  if (expanded) {
    return (
      <Card className="mb-2">
        <CardHeader
          onClick={onToggle}
          className="cursor-pointer flex flex-row items-center justify-between p-3"
        >
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">{job.title}</span>
            <Badge variant="outline">Completed</Badge>
          </div>
          <ChevronUp className="w-4 h-4 text-gray-400" />
        </CardHeader>
        <CardContent className="space-y-4">
          {output ? (
            <>
              {Array.isArray(output.extractedData?.documents) ? (
                output.extractedData.documents.map(
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (doc: any, idx: number) => (
                    <DataTable
                      key={idx}
                      headerData={doc.header}
                      lineItemsData={doc.lineItems}
                      headerFields={output.headerFields || []}
                      lineItemFields={output.lineItemFields || []}
                      onChange={() => {}}
                      onExportCSV={downloadCsv}
                    />
                  )
                )
              ) : (
                <DataTable
                  headerData={output.extractedData?.header}
                  lineItemsData={output.extractedData?.lineItems}
                  headerFields={output.headerFields || []}
                  lineItemFields={output.lineItemFields || []}
                  onChange={() => {}}
                  onExportCSV={downloadCsv}
                />
              )}
              <Button
                onClick={downloadCsv}
                variant="outline"
                className="mt-2 w-full"
              >
                <Download className="w-4 h-4 mr-2" /> Download CSV
              </Button>
            </>
          ) : (
            <div>Loading output...</div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      onClick={onToggle}
      className="bg-white border rounded-lg px-3 py-2 shadow-sm cursor-pointer hover:shadow-md transition-shadow mb-2 flex justify-between items-center"
    >
      <div>
        <span className="font-medium text-gray-900">{job.title}</span>
        <span className="text-xs text-gray-500 ml-2">
          ${(job.totalPrice / 100).toFixed(2)}
        </span>
      </div>
      <ChevronDown className="w-4 h-4 text-gray-400" />
    </div>
  );
} 