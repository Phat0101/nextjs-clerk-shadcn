"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api as convexApi } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import TimeRemaining from "@/components/TimeRemaining";
import { CheckCircle, AlertCircle, Loader2, FileText, Info } from "lucide-react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useChat } from "@ai-sdk/react";
import Markdown from "@/components/Markdown";
import FilesAndDocumentPanel, { JobFile } from "../../FilesAndDocumentPanel";
import ChatPanel from "../../ChatPanel";

interface SuggestedField {
    name: string;
    label: string;
  type: "string" | "number" | "date";
    description: string;
    required: boolean;
    example?: string;
}

interface AnalysisResult {
    headerFields: SuggestedField[];
    lineItemFields: SuggestedField[];
    documentType: string;
    confidence: number;
    notes?: string;
}

type WorkflowStep =
  | "loading"
  | "selecting"
  | "analyzing"
  | "confirming"
  | "extracting"
  | "reviewing"
  | "completed";

export default function JobInvoicePage(props: any) {
    // Next.js 15: params is a Promise in client components – unwrap it
    const params = React.use(props.params) as { jobId: string };
  const [currentStep, setCurrentStep] = useState<WorkflowStep>("loading");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [confirmedFields, setConfirmedFields] = useState<SuggestedField[]>([]);
  const [extractedData, setExtractedData] = useState<
    Record<string, string | number | null> | { documents: Record<string, string | number | null>[] }
  >({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supplierName, setSupplierName] = useState<string | null>(null);
  const [templateFound, setTemplateFound] = useState<boolean>(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateOptions, setTemplateOptions] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  // Preview index for document preview
  const [previewIndex, setPreviewIndex] = useState(0);
  const [isClassifying, setIsClassifying] = useState(false);

  // Tab selection for Confirm Fields UI (header vs line items)
  const [fieldsTab, setFieldsTab] = useState<"header" | "line">("header");

  // Add-field UI state
  const [showAddHeader, setShowAddHeader] = useState(false);
  const [showAddLine, setShowAddLine] = useState(false);
  const [newHeaderField, setNewHeaderField] = useState<{ label:string; type:'string'|'number'|'date'; description:string; required:boolean }>({label:'', type:'string', description:'', required:false});
  const [newLineField, setNewLineField] = useState<{ label:string; type:'string'|'number'|'date'; description:string; required:boolean }>({label:'', type:'string', description:'', required:false});

  // Middle-panel tab: 'fields' (suggested/confirmed) vs 'data' (extracted results)
  const [activeTab, setActiveTab] = useState<'fields'|'data'>('fields');

  const jobId = params.jobId as Id<"jobs">;
    const jobDetails = useQuery(convexApi.jobs.getDetails, { jobId });
    const completeJob = useMutation(convexApi.jobs.completeJob);
    const generateUploadUrl = useMutation(convexApi.jobs.generateUploadUrl);
    const updateStep = useMutation(convexApi.jobs.updateCompilerStep);
    const router = useRouter();

  // Show classified files if they exist, otherwise originals
  const displayFiles: JobFile[] = useMemo(() => {
    if (!jobDetails) return [];
    const classified = (jobDetails.files as JobFile[]).filter((f) => f.documentType);
    return classified.length ? classified : (jobDetails.files as JobFile[]);
  }, [jobDetails]);

  const selectedFileUrls = useMemo(() => displayFiles.map(f=>f.fileUrl).filter(Boolean) as string[], [displayFiles]);

    const {
        messages: chatMessages,
        input: chatInput,
        handleInputChange,
        handleSubmit,
        isLoading,
        append,
    } = useChat({
    api: "/api/agent/invoice",
    });

  // Chat auxiliary state
    const [queuedFileUrls, setQueuedFileUrls] = useState<string[]>([]);
    const thinkingLines = useMemo(() => {
        const lines: string[] = [];
        chatMessages.forEach((m: any) => {
            if (Array.isArray(m.parts)) {
                m.parts.forEach((p: any) => {
          if (p.type === "thinking" && typeof p.text === "string") {
                        lines.push(p.text);
                    }
                });
            }
        });
        return lines;
    }, [chatMessages]);

  const [mentionActive, setMentionActive] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);

    const mentionSuggestions = useMemo(() => {
        if (!mentionActive) return [] as (JobFile & { isAll?: boolean })[];
        const q = mentionQuery.toLowerCase();
    const arr: (JobFile & { isAll?: boolean })[] = [...displayFiles];
        if (displayFiles.length > 1) {
      arr.unshift({ _id: "all", fileName: "All Files", isAll: true } as any);
    }
    return arr.filter((f) => f.fileName.toLowerCase().includes(q));
    }, [mentionActive, mentionQuery, displayFiles]);

  const onChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || !chatInput.trim()) return;
    append({ role: "user", content: chatInput, fileUrls: queuedFileUrls } as any, {
      body: { jobId, fileUrls: queuedFileUrls, clientName: jobDetails?.client?.name ?? "" },
    });
    handleInputChange({ target: { value: "" } } as any);
    setQueuedFileUrls([]);
  };

  const handleChatInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleInputChange(e);
        const value = e.target.value;
        const caret = e.target.selectionStart || value.length;
        const sub = value.slice(0, caret);
        const atMatch = sub.match(/@([^\s]*)$/);
        if (atMatch) {
            setMentionActive(true);
            setMentionQuery(atMatch[1]);
        } else {
            setMentionActive(false);
      setMentionQuery("");
        }
        setMentionIndex(0);
    };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (mentionActive && mentionSuggestions.length) {
      if (e.key === "ArrowDown") {
                e.preventDefault();
                setMentionIndex((mentionIndex + 1) % mentionSuggestions.length);
      } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setMentionIndex((mentionIndex - 1 + mentionSuggestions.length) % mentionSuggestions.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
        const sel = mentionSuggestions[mentionIndex];
        if (sel) {
          if ((sel as any).isAll) attachAllFiles();
          else attachFile(sel.fileUrl || "", sel.fileName);
        }
      } else if (e.key === "Escape") {
        setMentionActive(false);
      }
    }
  };

  const attachAllFiles = () => {
    const urls = displayFiles.map((f) => f.fileUrl).filter(Boolean) as string[];
    const newUrls = urls.filter((u) => !queuedFileUrls.includes(u));
    setQueuedFileUrls((p) => [...p, ...newUrls]);

    // Remove unfinished mention token from input
    const cleaned = chatInput.replace(/@[^\s]*$/, '').trimEnd();
    handleInputChange({ target: { value: (cleaned + ' ').trimEnd() } } as any);
  };

  const attachFile = (url: string, name: string) => {
    if (!url || queuedFileUrls.includes(url)) return;
    setQueuedFileUrls((p) => [...p, url]);

    const cleaned = chatInput.replace(/@[^\s]*$/, '').trimEnd();
    handleInputChange({ target: { value: (cleaned + ' ').trimEnd() } } as any);
  };

  // Quick action handler (e.g. "Extract for shipment", "Extract for N10")
  const handleQuickAction = (prompt: string) => {
    if (isLoading) return;
    append({ role: "user", content: prompt } as any, {
      body: { jobId, fileUrls: queuedFileUrls, clientName: jobDetails?.client?.name ?? "" },
    });
  };

  // Handle selecting a file mention from the dropdown
  const handleMentionSelect = (sel: JobFile & { isAll?: boolean }) => {
    if ((sel as any).isAll) {
                        attachAllFiles();
                    } else {
      attachFile(sel.fileUrl || "", sel.fileName);
                    }
                setMentionActive(false);
  };

  const onRemoveQueuedFile = (u: string) => setQueuedFileUrls((p) => p.filter((x) => x !== u));

  // Automatically trigger extraction agent on initial load (no previous data)
  const autoTriggeredRef = React.useRef(false);

  useEffect(() => {
    if (!jobDetails) return;
    if (autoTriggeredRef.current) return;
    if (jobDetails.job.extractedData) return; // already processed

    // send a minimal user message to kick off agent with all files
    const fileUrlsAll = displayFiles.map(f=>f.fileUrl).filter(Boolean) as string[];
    if (fileUrlsAll.length === 0) return;

    append({ role: "user", content: "extract", fileUrls: fileUrlsAll } as any, {
      body: { jobId, fileUrls: fileUrlsAll, clientName: jobDetails?.client?.name ?? "" },
    });

    autoTriggeredRef.current = true;
  }, [jobDetails, displayFiles]);

  // Initialize workflow from saved job progress (or set default step)
  useEffect(() => {
    if (!jobDetails) return;

    if (currentStep === "loading") {
      if (jobDetails.job.extractedData) {
        setCurrentStep("reviewing");
      } else if (jobDetails.job.compilerStep) {
        setCurrentStep(jobDetails.job.compilerStep as WorkflowStep);
      } else {
        setCurrentStep("analyzing"); // trigger analyzing spinner while we wait for agent stream
      }

      // Restore any saved state
      if (jobDetails.job.analysisResult) setAnalysisResult(jobDetails.job.analysisResult as any);
      if (jobDetails.job.confirmedFields) setConfirmedFields(jobDetails.job.confirmedFields as any);
      if (jobDetails.job.extractedData) setExtractedData(jobDetails.job.extractedData as any);
      if (jobDetails.job.supplierName) setSupplierName(jobDetails.job.supplierName as string);
      if (jobDetails.job.templateFound !== undefined) setTemplateFound(jobDetails.job.templateFound as boolean);
    }
  }, [jobDetails, currentStep]);

  // Persist step and relevant data to backend when it changes (compiler only)
  useEffect(() => {
    if (!jobDetails) return;
    void updateStep({
      jobId,
      step: currentStep,
      analysisResult: analysisResult ?? undefined,
      confirmedFields: confirmedFields.length ? confirmedFields : undefined,
      extractedData: Object.keys(extractedData || {}).length ? extractedData : undefined,
      supplierName: supplierName ?? undefined,
      templateFound: templateFound ?? undefined,
    });
  }, [jobDetails, jobId, updateStep, currentStep, analysisResult, confirmedFields, extractedData, supplierName, templateFound]);

  // Ensure preview index resets if files list changes
  useEffect(() => {
    if (previewIndex >= displayFiles.length) {
      setPreviewIndex(0);
    }
  }, [displayFiles, previewIndex]);

  // Process incoming tool invocation results to drive state automatically
  const processedToolsRef = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    chatMessages.forEach((msg: any) => {
      if (!msg.toolInvocations) return;
      msg.toolInvocations.forEach((ti: any) => {
        if (processedToolsRef.current.has(ti.toolCallId)) return;
        if (ti.state !== 'result') return;

        if (ti.toolName === 'analyzeInvoice' && ti.result?.headerFields && ti.result?.lineItemFields) {
          const result = ti.result;
          setAnalysisResult({
            headerFields: result.headerFields,
            lineItemFields: result.lineItemFields,
            documentType: 'Invoice',
            confidence: 1,
          });
          setConfirmedFields([...result.headerFields, ...result.lineItemFields]);
          setCurrentStep('confirming');
        }

        if (ti.toolName === 'extractInvoice' && ti.result?.extractedData) {
          setExtractedData(ti.result.extractedData);
          setAnalysisResult((prev)=>prev||{headerFields:ti.result.headerFields||[], lineItemFields:ti.result.lineItemFields||[], documentType:'Invoice', confidence:1});
          setActiveTab('data');
          setCurrentStep("reviewing");
        }

        if (ti.toolName === 'matchTemplate' && Array.isArray(ti.result) && ti.result.length) {
          // Save top matches
          setTemplateOptions(ti.result);
          setTemplateFound(true);

          // Auto-pick first template if none selected yet
          if (!selectedTemplateId) {
            const first = ti.result[0];
            setSelectedTemplateId(first.templateId);
            if (!supplierName && first.supplier) setSupplierName(first.supplier);
            setAnalysisResult({
              headerFields: first.headerFields,
              lineItemFields: first.lineItemFields,
              documentType: 'Invoice',
              confidence: first.score || 1,
            });
            setConfirmedFields([...first.headerFields, ...first.lineItemFields]);
          }
        }

        processedToolsRef.current.add(ti.toolCallId);
      });
    });
  }, [chatMessages]);

  const confirmFields = async () => {
    // Check if no fields are confirmed
    if (confirmedFields.length === 0) {
      setError("Please select at least one field to extract");
      return;
    }

    const selectedFiles = displayFiles;

    setCurrentStep("extracting");
    setIsProcessing(true);
    setError(null);

    try {
      // Split confirmed fields into header vs line-item groups based on original suggestions
      const headerFieldsSelected = confirmedFields.filter((f) =>
        analysisResult?.headerFields.some((h) => h.name === f.name)
      );
      const lineItemFieldsSelected = confirmedFields.filter((f) =>
        analysisResult?.lineItemFields.some((l) => l.name === f.name)
      );

      // Check if files have URLs (Convex storage)
      const hasUrls = selectedFiles.every((file) => file?.fileUrl);

      if (hasUrls) {
        const fileUrls = selectedFiles.map((file) => file?.fileUrl).filter(Boolean);
        const response = await fetch("/api/extract/invoice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileUrls,
            headerFields: headerFieldsSelected,
            lineItemFields: lineItemFieldsSelected,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to extract data");
        }

        const result = await response.json();
        setExtractedData(result.extractedData);
        setActiveTab('data');
        setCurrentStep("reviewing");
      } else {
        throw new Error("File URLs not available for selected files");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Data extraction failed");
      setCurrentStep("confirming");
    } finally {
      setIsProcessing(false);
    }
  };

  // No-op toggle (selection UI removed)
  const toggleFileSelection = () => {};

  const handleFieldToggle = (fieldName: string) => {
    setConfirmedFields((prev) => {
      const exists = prev.find((f) => f.name === fieldName);
      if (exists) {
        return prev.filter((f) => f.name !== fieldName);
            } else {
        const original =
          analysisResult?.headerFields.find((f) => f.name === fieldName) ||
          analysisResult?.lineItemFields.find((f) => f.name === fieldName);
        return original ? [...prev, original] : prev;
      }
    });
  };

  const handleDataChange = (updatedData: any) => {
    setExtractedData(updatedData);
  };

  const handleExportCSV = async () => {
    try {
      const response = await fetch("/api/export-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: extractedData,
          jobTitle: jobDetails?.job.title,
          fields: confirmedFields,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to export CSV");
      }

      // Trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        response.headers
          .get("Content-Disposition")
          ?.split('filename="')[1]
          ?.split('"')[0] || "export.csv";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
            } catch (err) {
      console.error("Export failed:", err);
      alert("Failed to export CSV");
    }
  };

  const completeJobWithExtractedData = async () => {
    setIsProcessing(true);
    try {
      // 1. Generate CSV blob from extracted data via existing API route
      const csvResp = await fetch("/api/export-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: extractedData,
          jobTitle: jobDetails?.job.title,
          fields: confirmedFields,
        }),
      });

      if (!csvResp.ok) {
        throw new Error("Failed to generate CSV");
      }

      const csvBlob = await csvResp.blob();

      // 2. Get upload URL from Convex
      const uploadUrl = await generateUploadUrl();

      // 3. Upload CSV to Convex storage
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: csvBlob,
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload CSV");
      }

      const { storageId } = await uploadRes.json();

      // 4. Call backend mutation to mark job complete and store data
      await completeJob({
        jobId,
        csvStorageId: storageId,
        headerFields: analysisResult?.headerFields,
        lineItemFields: analysisResult?.lineItemFields,
        extractedData,
      });

      setCurrentStep("completed");

      // Redirect after a short delay
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch (error) {
      console.error("Error completing job:", error);
      alert("Error completing job. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLabelChange = (fieldName: string, newLabel: string) => {
    setConfirmedFields((prev) =>
      prev.map((f) => (f.name === fieldName ? { ...f, label: newLabel } : f))
    );
  };

  const handleSaveTemplate = async () => {
    let sup = supplierName;
    if (!sup) {
      sup = prompt('Enter supplier/company name to save template:', '') || '';
      if (!sup.trim()) return;
      setSupplierName(sup);
    }
    if (!analysisResult) return;
    setIsSavingTemplate(true);
    try {
      // Split confirmed fields into header vs line-item groups based on analysisResult
      const headerFieldsSelected = confirmedFields.filter((f) =>
        analysisResult?.headerFields.some((h) => h.name === f.name)
      );
      const lineItemFieldsSelected = confirmedFields.filter((f) =>
        analysisResult?.lineItemFields.some((l) => l.name === f.name)
      );

      const response = await fetch("/api/templates/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplateId,
          supplier: sup,
          clientName: jobDetails?.client?.name ?? "",
          headerFields: headerFieldsSelected,
          lineItemFields: lineItemFieldsSelected,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save template");
      }

      const json = await response.json();
      if (json.templateId) {
        setSelectedTemplateId(json.templateId);
        setTemplateFound(true);

        // If this is a brand-new template, append it to the dropdown list so the user can pick/update later
        if (!templateOptions.some((t:any)=>t.templateId===json.templateId)) {
          const newTpl = {
            templateId: json.templateId,
            supplier: sup,
            clientName: jobDetails?.client?.name ?? "",
            headerFields: headerFieldsSelected,
            lineItemFields: lineItemFieldsSelected,
            score: 1,
          };
          setTemplateOptions((prev)=>[...prev, newTpl]);
        }
      }

      alert(templateFound ? "Template updated!" : "Template saved!");
    } catch (err) {
      console.error("Save template failed", err);
      alert("Failed to save template");
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    const tpl = templateOptions.find((t) => t.templateId === templateId);
    if (!tpl) return;
    setSelectedTemplateId(templateId);
    setAnalysisResult({
      headerFields: tpl.headerFields,
      lineItemFields: tpl.lineItemFields,
      documentType: "Invoice",
      confidence: tpl.score || 1,
    });
    setConfirmedFields([...tpl.headerFields, ...tpl.lineItemFields]);
  };

  const toCamelCase = (text: string) =>
    text
      .replace(/[^a-zA-Z0-9 ]/g, " ")
      .split(" ")
      .filter(Boolean)
      .map((w, i) =>
        i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      )
      .join("");

  const addCustomField = (scope: "header" | "line") => {
    const pending = scope === "header" ? newHeaderField : newLineField;
    if (!pending.label.trim()) return;
    const field = {
      name: toCamelCase(pending.label),
      label: pending.label,
      type: pending.type,
      description: pending.description,
      required: pending.required,
    } as SuggestedField;

    // Update analysisResult for consistent rendering
    setAnalysisResult((prev) =>
      prev
        ? {
            ...prev,
            headerFields: scope === "header" ? [...prev.headerFields, field] : prev.headerFields,
            lineItemFields: scope === "line" ? [...prev.lineItemFields, field] : prev.lineItemFields,
          }
        : null
    );

    // Mark as selected by default
    setConfirmedFields((prev) => [...prev, field]);

    // Reset
    if (scope === "header") {
      setNewHeaderField({ label: "", type: "string", description: "", required: false });
      setShowAddHeader(false);
    } else {
      setNewLineField({ label: "", type: "string", description: "", required: false });
      setShowAddLine(false);
    }
  };

  if (jobDetails === undefined) {
        return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin mr-2" />
        <div>Loading job details...</div>
                    </div>
    );
  }

  if (!jobDetails) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Job Not Found</h2>
          <p className="text-muted-foreground mb-4">
            You don&apos;t have permission to view this job or it doesn&apos;t exist.
          </p>
        </div>
        </div>
    );
  }

  const { job } = jobDetails;

  // -----------------------------
  // RENDERING
  // -----------------------------

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
      <div className="bg-white border-b p-1 px-2 flex justify-between items-center gap-4">
        <h1 className="text-xl font-bold truncate" title={job.title}>{job.title}</h1>
                    <TimeRemaining deadline={job.deadline} />
                </div>

      {/* Main Split Layout */}
            <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* LEFT – files & preview */}
                <ResizablePanel defaultSize={25} minSize={15}>
                    <FilesAndDocumentPanel
                        displayFiles={displayFiles}
                        previewIndex={previewIndex}
                        onPreviewChange={setPreviewIndex}
                    />
                </ResizablePanel>

                <ResizableHandle withHandle />

        {/* MIDDLE – extraction UI */}
                <ResizablePanel defaultSize={50} minSize={35}>
          {/* TAB HEADER (visible once analysisResult available) */}
          {analysisResult && (
            <div className="flex items-center gap-4 border-b px-4 py-2">
                                        <button
                onClick={() => setActiveTab('fields')}
                className={`text-sm font-medium pb-1 border-b-2 transition-colors ${activeTab==='fields' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-blue-600'}`}
              >
                Suggested Fields
                                        </button>
                                        <button
                onClick={() => extractedData && Object.keys(extractedData).length && setActiveTab('data')}
                disabled={!extractedData || !Object.keys(extractedData).length}
                className={`text-sm font-medium pb-1 border-b-2 transition-colors ${activeTab==='data' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-blue-600'} ${(!extractedData || !Object.keys(extractedData).length) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Extracted Data
                                        </button>
                                    </div>
          )}

          {/* ANALYZING */}
          {currentStep === "analyzing" && (
            <div className="p-6 flex flex-col items-center gap-2 text-center">
              <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
              <h3 className="text-lg font-semibold">Analyzing Document{displayFiles.length>1?"s":""}</h3>
              <p className="text-sm text-muted-foreground">AI is suggesting fields for extraction…</p>
                            </div>
                        )}

          {/* SUGGESTED FIELDS TABLE */}
          {analysisResult && activeTab === 'fields' && (
            <div className="h-[calc(100vh-5rem)] flex flex-col p-4 gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold flex-1">Confirm Fields</h3>
                {analysisResult.notes && (
                  <Info className="w-4 h-4 text-muted-foreground" />
                )}
              </div>

              {/* Template picker */}
              {templateOptions.length > 0 && (
                <div>
                  <label className="text-sm font-medium mb-1 block">Template Suggestions</label>
                  <Select value={selectedTemplateId || ""} onValueChange={handleTemplateSelect}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Choose a template"/></SelectTrigger>
                    <SelectContent>
                      {templateOptions.map((t:any)=> (
                        <SelectItem key={t.templateId} value={t.templateId}>{t.supplier}{t.clientName?` - ${t.clientName}`:""} ({Math.round((t.score||0)*100)}%)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                                                    </div>
              )}

              {/* Tabs */}
              <div className="flex gap-4 text-sm font-medium border-b mb-2">
                {(["header","line"] as const).map(tab=> (
                  <button key={tab} onClick={()=>setFieldsTab(tab)} className={`pb-2 ${fieldsTab===tab?"border-b-2 border-blue-600 text-blue-600":"text-gray-600 hover:text-blue-600"}`}>{tab==="header"?"Invoice Header Fields":"Line Item Fields"}</button>
                ))}
                                                    </div>

              {/* Table */}
              <div className="flex-1 overflow-y-auto border rounded">
                <table className="w-full text-sm table-fixed">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr className="text-left">
                      <th className="w-12 p-2 border-b text-center">✓</th>
                      <th className="w-40 p-2 border-b">Label</th>
                      <th className="w-20 p-2 border-b">Type</th>
                      <th className="w-20 p-2 border-b">Required</th>
                      <th className="p-2 border-b">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(fieldsTab==="header"?analysisResult.headerFields:analysisResult.lineItemFields).map(field=> {
                      const selected=confirmedFields.some(f=>f.name===field.name);
                      const fieldLabel=confirmedFields.find(f=>f.name===field.name)?.label||field.label;
                                        return (
                        <tr key={field.name} className={selected?"bg-gray-50":"hover:bg-gray-25"}>
                          <td className="w-12 p-2 border-b text-center">
                            <div onClick={()=>handleFieldToggle(field.name)} className={`w-4 h-4 rounded border-2 mx-auto cursor-pointer flex items-center justify-center ${selected?"bg-blue-600 border-blue-600":"border-gray-300"}`}>{selected&&<CheckCircle className="w-3 h-3 text-white"/>}</div>
                          </td>
                          <td className="w-40 p-2 border-b">
                            <div
                              contentEditable
                              suppressContentEditableWarning
                              className="font-medium outline-none truncate hover:border-gray-300 focus:border-blue-500 border border-transparent rounded px-1"
                              onBlur={(e)=>handleLabelChange(field.name, e.currentTarget.textContent||"")}
                              title={fieldLabel}
                            >
                              {fieldLabel}
                                            </div>
                          </td>
                          <td className="w-20 p-2 border-b"><Badge variant="outline" className="text-xs">{field.type}</Badge></td>
                          <td className="w-20 p-2 border-b text-center">{field.required?"✓":""}</td>
                          <td className="p-2 border-b text-xs text-muted-foreground truncate" title={field.description}>{field.description}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Actions */}
              <div className="space-y-2 mt-3">
                <Button
                  variant="outline"
                  onClick={handleSaveTemplate}
                  disabled={isSavingTemplate||confirmedFields.length===0}
                  className="w-full"
                >
                  {isSavingTemplate?"Saving Template…": templateFound?"Update Template":"Save as Template"}
                </Button>
                <Button onClick={confirmFields} disabled={confirmedFields.length===0||isProcessing} className="w-full">
                  {isProcessing?"Extracting…":`Extract ${confirmedFields.length} Field${confirmedFields.length!==1?"s":""}`}
                </Button>
                                                </div>
                                                </div>
          )}

          {/* EXTRACTING */}
          {currentStep === "extracting" && (
            <div className="p-6 flex flex-col items-center gap-2 text-center"><Loader2 className="w-12 h-12 animate-spin text-blue-600"/><h3 className="text-lg font-semibold">Extracting Data…</h3></div>
          )}

          {/* EXTRACTED DATA TABLE */}
          {activeTab === 'data' && extractedData && Object.keys(extractedData).length > 0 && (
            <div className="p-4 h-full overflow-y-auto space-y-4">
              {Array.isArray((extractedData as any).documents)? (
                (extractedData as {documents:any[]}).documents.map((doc,index)=> (
                  <div key={index} className="border rounded-lg p-4 space-y-2">
                    <h4 className="font-medium text-sm">Document {index+1}</h4>
                    <DataTable
                      headerData={doc.header}
                      lineItemsData={doc.lineItems}
                      headerFields={confirmedFields.filter(f=>analysisResult?.headerFields.some(h=>h.name===f.name))}
                      lineItemFields={confirmedFields.filter(f=>analysisResult?.lineItemFields.some(l=>l.name===f.name))}
                      onChange={(updated:any)=>{
                        const current=extractedData as {documents:any[]};
                        const newDocs=[...current.documents];
                        newDocs[index]=updated;
                        handleDataChange({documents:newDocs});
                      }}
                      onExportCSV={handleExportCSV}
                    />
                                            </div>
                ))
              ) : (
                <DataTable
                  headerData={(extractedData as any).header}
                  lineItemsData={(extractedData as any).lineItems}
                  headerFields={confirmedFields.filter(f=>analysisResult?.headerFields.some(h=>h.name===f.name))}
                  lineItemFields={confirmedFields.filter(f=>analysisResult?.lineItemFields.some(l=>l.name===f.name))}
                  onChange={handleDataChange}
                  onExportCSV={handleExportCSV}
                />
              )}

              <Button className="w-full" onClick={completeJobWithExtractedData} disabled={isProcessing}>{isProcessing?"Completing Job…":"Complete Job"}</Button>
                                    </div>
          )}

          {/* COMPLETED */}
          {currentStep === "completed" && (
            <div className="p-6 flex flex-col items-center gap-2 text-center"><CheckCircle className="w-12 h-12 text-green-600"/><h3 className="text-lg font-semibold">Job Completed!</h3><p className="text-sm text-muted-foreground">Redirecting to dashboard…</p></div>
          )}
                </ResizablePanel>

                <ResizableHandle withHandle />

        {/* RIGHT – chat */}
                <ResizablePanel defaultSize={25} minSize={15}>
                    <ChatPanel
                        chatMessages={chatMessages}
                        chatInput={chatInput}
                        isLoading={isLoading}
                        queuedFileUrls={queuedFileUrls}
                        displayFiles={displayFiles}
                        previewIndex={previewIndex}
                        onPreviewChange={setPreviewIndex}
                        thinkingLines={thinkingLines}
                        onChatSubmit={onChatSubmit}
            onInputChange={handleChatInputChange}
            onInputKeyDown={handleInputKeyDown}
                        onQuickAction={handleQuickAction}
                        onFileAttach={attachFile}
            onRemoveQueuedFile={onRemoveQueuedFile}
                        mentionActive={mentionActive}
                        mentionSuggestions={mentionSuggestions}
                        mentionIndex={mentionIndex}
            onMentionSelect={handleMentionSelect}
                        onMentionClose={() => setMentionActive(false)}
                    />
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
} 