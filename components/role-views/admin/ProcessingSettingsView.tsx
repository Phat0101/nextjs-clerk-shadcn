"use client";

import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ProcessingSettingsView() {
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
      console.error("Failed to update processing mode", error);
      alert("Failed to update processing mode");
    }
    setIsSaving(false);
  };

  const handleInitializeDefaults = async () => {
    try {
      await initializeSettings();
      alert("Default settings initialized!");
    } catch (error) {
      console.error("Failed to initialize settings", error);
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