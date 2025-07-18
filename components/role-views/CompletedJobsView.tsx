"use client";

import React, { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function CompletedJobsView() {
  const jobs = useQuery(api.jobs.getMyCompleted);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  if (jobs === undefined) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Completed Jobs</h1>
      {jobs.length === 0 && <p className="text-gray-500">No completed jobs.</p>}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {jobs.map((job: any) => (
        <CompletedJobCard
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

function CompletedJobCard({
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
      <Card className="mb-2 p-0">
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
        <CardContent className="space-y-4 mb-2">
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
      </div>
      <ChevronDown className="w-4 h-4 text-gray-400" />
    </div>
  );
} 