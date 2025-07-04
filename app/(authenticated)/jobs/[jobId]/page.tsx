/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

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
import DocumentView from "./documentView";

interface SuggestedField {
    name: string;
    label: string;
    type: 'string' | 'number' | 'date';
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

type WorkflowStep = 'loading' | 'selecting' | 'analyzing' | 'confirming' | 'extracting' | 'reviewing' | 'completed';

// Shared file type used across job views
interface JobFile {
    _id: string;
    fileUrl?: string | null;
    fileType?: string;
    fileName: string;
    documentType?: string | null;
    pageNumbers?: number[] | number;
    fileSize?: number;
}

export default function JobWorkPage(props: any) {
    // Next.js 15: params is a Promise in client components – unwrap it
    const params = React.use(props.params) as { jobId: string };
    const [currentStep, setCurrentStep] = useState<WorkflowStep>('loading');
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [confirmedFields, setConfirmedFields] = useState<SuggestedField[]>([]);
    const [extractedData, setExtractedData] = useState<Record<string, string | number | null> | { documents: Record<string, string | number | null>[] }>({});
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedFileIndices, setSelectedFileIndices] = useState<number[]>([]);
    const [supplierName, setSupplierName] = useState<string | null>(null);
    const [templateFound, setTemplateFound] = useState<boolean>(false);
    const [isSavingTemplate, setIsSavingTemplate] = useState(false);
    const [templateOptions, setTemplateOptions] = useState<any[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    // Preview index for DocumentView
    const [previewFileIndex, setPreviewFileIndex] = useState(0);
    const [isClassifying, setIsClassifying] = useState(false);

    // Tab selection for Confirm Fields UI (header vs line items)
    const [fieldsTab, setFieldsTab] = useState<'header' | 'line'>('header');

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

    const selectedFileUrls = useMemo(() => {
        if (!jobDetails) return [] as string[];
        return selectedFileIndices
            .map(i => displayFiles?.[i]?.fileUrl)
            .filter(Boolean) as string[];
    }, [displayFiles, selectedFileIndices]);

    const {
        messages: chatMessages,
        input: chatInput,
        handleInputChange: handleChatInputChange,
        handleSubmit: originalHandleSubmit,
    } = useChat({
        api: "/api/job-chat",
    });

    const handleChatSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        originalHandleSubmit(e, { body: { fileUrls: selectedFileUrls } });
    };

    // New state for creating custom fields
    const [showAddHeader, setShowAddHeader] = useState(false);
    const [showAddLine, setShowAddLine] = useState(false);
    const [newHeaderField, setNewHeaderField] = useState<{ label: string; type: 'string' | 'number' | 'date'; description: string; required: boolean }>({ label: '', type: 'string', description: '', required: false });
    const [newLineField, setNewLineField] = useState<{ label: string; type: 'string' | 'number' | 'date'; description: string; required: boolean }>({ label: '', type: 'string', description: '', required: false });

    // Initialize workflow from saved job progress if available
    useEffect(() => {
        if (!jobDetails) return;

        if (currentStep === 'loading') {
            if (jobDetails.job.compilerStep) {
                setCurrentStep(jobDetails.job.compilerStep as WorkflowStep);
            } else {
                setCurrentStep('selecting');
            }

            // Restore saved data
            if (jobDetails.job.analysisResult) setAnalysisResult(jobDetails.job.analysisResult as any);
            if (jobDetails.job.confirmedFields) setConfirmedFields(jobDetails.job.confirmedFields as any);
            if (jobDetails.job.extractedData) setExtractedData(jobDetails.job.extractedData as any);
            if (jobDetails.job.supplierName) setSupplierName(jobDetails.job.supplierName as string);
            if (jobDetails.job.templateFound !== undefined) setTemplateFound(jobDetails.job.templateFound as boolean);
        }
    }, [jobDetails]);

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

    // Auto-select original indices update
    useEffect(() => {
        if (!jobDetails) return;
        if (currentStep === 'selecting' && selectedFileIndices.length === 0) {
            const originalIndices = displayFiles.map((_ignored: unknown, i: number) => i);
            setSelectedFileIndices(originalIndices);
        }
    }, [jobDetails, currentStep, displayFiles]);

    // After classify auto select grouped
    useEffect(() => {
        if (!jobDetails) return;
        if (currentStep === 'selecting' && selectedFileIndices.length === 0) {
            const groupedIdx = displayFiles.map((_ignored: unknown, i: number) => i);
            if (groupedIdx.length) { setSelectedFileIndices(groupedIdx); }
        }
    }, [jobDetails, currentStep, displayFiles, selectedFileIndices.length]);

    // Ensure previewFileIndex is always within bounds of displayFiles
    useEffect(() => {
        if (previewFileIndex >= displayFiles.length) {
            setPreviewFileIndex(0);
        }
    }, [displayFiles, previewFileIndex]);

    const startAnalysis = async () => {
        if (selectedFileIndices.length === 0) {
            setError("No files selected for analysis");
            return;
        }

        const selectedFiles = selectedFileIndices.map(index => jobDetails?.files?.[index]).filter(Boolean);
        if (selectedFiles.length === 0) {
            setError("Selected files not found");
            return;
        }

        setCurrentStep('analyzing');
        setIsProcessing(true);
        setError(null);

        try {
            // Ensure files have URLs
            const hasUrls = selectedFiles.every(file => file?.fileUrl);
            if (!hasUrls) throw new Error('File URLs not available for selected files');

            const fileUrls = selectedFiles.map(file => file?.fileUrl).filter(Boolean);

            // 1. Call agent to attempt template match
            const agentRes = await fetch('/api/agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientName: jobDetails?.client?.name ?? '', fileUrls }),
            });

            const agentJson = await agentRes.json();

            if (agentJson && Array.isArray(agentJson.templates) && agentJson.templates.length > 0) {
                // Multiple template suggestions
                setTemplateFound(true);
                setSupplierName(agentJson.supplier || "");
                setTemplateOptions(agentJson.templates);
                const first = agentJson.templates[0];
                setSelectedTemplateId(first.templateId);
                setAnalysisResult({
                    headerFields: first.headerFields,
                    lineItemFields: first.lineItemFields,
                    documentType: 'Invoice',
                    confidence: first.score || 1,
                });
                setConfirmedFields([...first.headerFields, ...first.lineItemFields]);
                setCurrentStep('confirming');
            } else {
                // No template found case
                setTemplateFound(false);
                setSupplierName(agentJson.supplier || "");
                // No template, fall back to analysis workflow
                const response = await fetch('/api/analyze-invoice', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ clientName: jobDetails?.client?.name ?? '', fileUrls }),
                });

                if (!response.ok) {
                    throw new Error('Failed to analyze documents');
                }

                const result: AnalysisResult = await response.json();
                setAnalysisResult(result);
                const mergedFields = [...result.headerFields, ...result.lineItemFields];
                setConfirmedFields(mergedFields);
                setCurrentStep('confirming');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Analysis failed');
            setCurrentStep('selecting');
        } finally {
            setIsProcessing(false);
        }
    };

    const confirmFileSelection = () => {
        startAnalysis();
    };

    const confirmFields = async () => {
        // Check if no files are selected - redirect to file selection
        if (selectedFileIndices.length === 0) {
            setCurrentStep('selecting');
            return;
        }

        // Check if no fields are confirmed
        if (confirmedFields.length === 0) {
            setError("Please select at least one field to extract");
            return;
        }

        const selectedFiles = selectedFileIndices.map(index => jobDetails?.files?.[index]).filter(Boolean);

        setCurrentStep('extracting');
        setIsProcessing(true);
        setError(null);

        try {
            // Split confirmed fields into header vs line-item groups based on original suggestions
            const headerFieldsSelected = confirmedFields.filter(f => analysisResult?.headerFields.some(h => h.name === f.name));
            const lineItemFieldsSelected = confirmedFields.filter(f => analysisResult?.lineItemFields.some(l => l.name === f.name));

            // Check if files have URLs (Convex storage) 
            const hasUrls = selectedFiles.every(file => file?.fileUrl);

            if (hasUrls) {
                const fileUrls = selectedFiles.map(file => file?.fileUrl).filter(Boolean);
                const response = await fetch('/api/extract-data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        clientName: jobDetails?.client?.name ?? '',
                        fileUrls,
                        headerFields: headerFieldsSelected,
                        lineItemFields: lineItemFieldsSelected,
                    }),
                });

                if (!response.ok) {
                    throw new Error('Failed to extract data');
                }

                const result = await response.json();
                setExtractedData(result.extractedData);
                setCurrentStep('reviewing');
            } else {
                throw new Error('File URLs not available for selected files');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Data extraction failed');
            setCurrentStep('confirming');
        } finally {
            setIsProcessing(false);
        }
    };

    const toggleFileSelection = (index: number) => {
        setSelectedFileIndices(prev => {
            if (prev.includes(index)) {
                return prev.filter(i => i !== index);
            } else {
                return [...prev, index];
            }
        });
    };

    const handleFieldToggle = (fieldName: string) => {
        setConfirmedFields(prev => {
            const exists = prev.find(f => f.name === fieldName);
            if (exists) {
                return prev.filter(f => f.name !== fieldName);
            } else {
                const original = analysisResult?.headerFields.find(f => f.name === fieldName) || analysisResult?.lineItemFields.find(f => f.name === fieldName);
                return original ? [...prev, original] : prev;
            }
        });
    };

    const handleDataChange = (updatedData: any) => {
        setExtractedData(updatedData);
    };

    const handleExportCSV = async () => {
        try {
            const response = await fetch('/api/export-csv', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data: extractedData,
                    jobTitle: jobDetails?.job.title,
                    fields: confirmedFields,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to export CSV');
            }

            // Trigger download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = response.headers.get('Content-Disposition')?.split('filename="')[1]?.split('"')[0] || 'export.csv';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            console.error('Export failed:', err);
            alert('Failed to export CSV');
        }
    };

    const completeJobWithExtractedData = async () => {
        setIsProcessing(true);
        try {
            // 1. Generate CSV blob from extracted data via existing API route
            const csvResp = await fetch('/api/export-csv', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data: extractedData,
                    jobTitle: jobDetails?.job.title,
                    fields: confirmedFields,
                }),
            });

            if (!csvResp.ok) {
                throw new Error('Failed to generate CSV');
            }

            const csvBlob = await csvResp.blob();

            // 2. Get upload URL from Convex
            const uploadUrl = await generateUploadUrl();

            // 3. Upload CSV to Convex storage
            const uploadRes = await fetch(uploadUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/csv' },
                body: csvBlob,
            });

            if (!uploadRes.ok) {
                throw new Error('Failed to upload CSV');
            }

            // Response format: { storageId: string }
            const { storageId } = await uploadRes.json();

            // 4. Call backend mutation to mark job complete and store data
            await completeJob({
                jobId,
                csvStorageId: storageId,
                headerFields: analysisResult?.headerFields,
                lineItemFields: analysisResult?.lineItemFields,
                extractedData,
            });

            setCurrentStep('completed');

            // Redirect after a short delay
            setTimeout(() => {
                router.push('/dashboard');
            }, 2000);

        } catch (error) {
            console.error('Error completing job:', error);
            alert('Error completing job. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleLabelChange = (fieldName: string, newLabel: string) => {
        setConfirmedFields(prev => prev.map(f => f.name === fieldName ? { ...f, label: newLabel } : f));
    };

    const handleSaveTemplate = async () => {
        if (!supplierName || !analysisResult) return;
        setIsSavingTemplate(true);
        try {
            // Split confirmed fields into header vs line-item groups based on analysisResult
            const headerFieldsSelected = confirmedFields.filter(f => analysisResult?.headerFields.some(h => h.name === f.name));
            const lineItemFieldsSelected = confirmedFields.filter(f => analysisResult?.lineItemFields.some(l => l.name === f.name));

            const response = await fetch('/api/templates/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    templateId: selectedTemplateId,
                    supplier: supplierName,
                    clientName: jobDetails?.client?.name ?? "",
                    headerFields: headerFieldsSelected,
                    lineItemFields: lineItemFieldsSelected,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to save template');
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
        const tpl = templateOptions.find(t => t.templateId === templateId);
        if (!tpl) return;
        setSelectedTemplateId(templateId);
        setAnalysisResult({
            headerFields: tpl.headerFields,
            lineItemFields: tpl.lineItemFields,
            documentType: 'Invoice',
            confidence: tpl.score || 1,
        });
        setConfirmedFields([...tpl.headerFields, ...tpl.lineItemFields]);
    };

    const toCamelCase = (text: string) => text
        .replace(/[^a-zA-Z0-9 ]/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join('');

    const addCustomField = (scope: 'header' | 'line') => {
        const pending = scope === 'header' ? newHeaderField : newLineField;
        if (!pending.label.trim()) return;
        const field = {
            name: toCamelCase(pending.label),
            label: pending.label,
            type: pending.type,
            description: pending.description,
            required: pending.required,
        } as SuggestedField;

        // Update analysisResult for consistent rendering
        setAnalysisResult(prev => prev ? {
            ...prev,
            headerFields: scope === 'header' ? [...prev.headerFields, field] : prev.headerFields,
            lineItemFields: scope === 'line' ? [...prev.lineItemFields, field] : prev.lineItemFields,
        } : null);

        // Mark as selected by default
        setConfirmedFields(prev => [...prev, field]);

        // Reset
        if (scope === 'header') {
            setNewHeaderField({ label: '', type: 'string', description: '', required: false });
            setShowAddHeader(false);
        } else {
            setNewLineField({ label: '', type: 'string', description: '', required: false });
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

    const { job, files } = jobDetails;

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="bg-white border-b p-1 px-2">
                <div className="flex justify-between items-center gap-4">
                    <h1 className="text-xl font-bold">{job.title}</h1>
                    <TimeRemaining deadline={job.deadline} />
                </div>
            </div>

            {/* Removed top-level progress bar – navigation moved to side panel */}

            {/* Error Display */}
            {error && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4 m-4">
                    <div className="flex">
                        <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
                        <div>
                            <h3 className="text-sm font-medium text-red-800">Error</h3>
                            <p className="text-sm text-red-700">{error}</p>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={startAnalysis}
                                className="mt-2"
                            >
                                Retry Analysis
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <ResizablePanelGroup direction="horizontal" className="flex-1">
                {/* Chat & Progress Side Panel */}
                <ResizablePanel defaultSize={20} minSize={15}>
                    <div className="h-full flex flex-col bg-white">
                        {/* Progress (task list) */}
                        <div className="p-4 border-b">
                            <h3 className="font-semibold mb-2">Progress</h3>
                            <div className="space-y-2">
                                {[
                                    { key: 'selecting', label: 'Select File' },
                                    { key: 'analyzing', label: 'AI Analysis' },
                                    { key: 'confirming', label: 'Confirm Fields' },
                                    { key: 'extracting', label: 'Extract Data' },
                                    { key: 'reviewing', label: 'Review & Edit' },
                                    { key: 'completed', label: 'Complete' },
                                ].map((step) => {
                                    const completed =
                                        ['selecting', 'analyzing', 'confirming', 'extracting', 'reviewing', 'completed'].indexOf(currentStep) >
                                        ['selecting', 'analyzing', 'confirming', 'extracting', 'reviewing', 'completed'].indexOf(step.key);
                                    const active = currentStep === step.key;
                                    return (
                                        <div key={step.key} className="flex items-center gap-2 text-sm">
                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${active ? 'bg-blue-600 border-blue-600' : completed ? 'bg-green-600 border-green-600' : 'border-gray-300'}`}> {active || completed ? <CheckCircle className="w-3 h-3 text-white" /> : null}</div>
                                            <span className={active ? 'font-medium text-blue-600' : completed ? 'text-green-600' : 'text-gray-600'}>{step.label}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Inline Back / Next controls */}
                            <div className="flex justify-between mt-4">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={currentStep === 'selecting' || currentStep === 'loading'}
                                    onClick={() => {
                                        const order: WorkflowStep[] = ['selecting', 'analyzing', 'confirming', 'extracting', 'reviewing', 'completed'];
                                        const idx = order.indexOf(currentStep);
                                        if (idx > 0) setCurrentStep(order[idx - 1]);
                                    }}
                                >
                                    ← Back
                                </Button>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={currentStep === 'completed' || currentStep === 'loading'}
                                    onClick={() => {
                                        if (isProcessing) return;
                                        switch (currentStep) {
                                            case 'selecting':
                                                confirmFileSelection();
                                                break;
                                            case 'confirming':
                                                confirmFields();
                                                break;
                                            case 'reviewing':
                                                completeJobWithExtractedData();
                                                break;
                                            default: {
                                                const order: WorkflowStep[] = ['selecting', 'analyzing', 'confirming', 'extracting', 'reviewing', 'completed'];
                                                const idx = order.indexOf(currentStep);
                                                if (idx < order.length - 1) setCurrentStep(order[idx + 1]);
                                            }
                                        }
                                    }}
                                >
                                    Next →
                                </Button>
                            </div>
                        </div>

                        {/* Chat Area */}
                        <div className="flex-1 flex flex-col overflow-hidden">
                            <div className="p-4 overflow-y-auto flex-1 space-y-3">
                                {chatMessages.map((m) => (
                                    <div key={m.id} className="space-y-1">
                                        <div className="text-xs font-semibold text-gray-500">{m.role === 'user' ? 'You' : 'AI'}</div>
                                        <Markdown content={m.content} />
                                    </div>
                                ))}
                            </div>
                            <form onSubmit={handleChatSubmit} className="p-3 border-t flex gap-2">
                                <input
                                    className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="Ask AI..."
                                    value={chatInput}
                                    onChange={handleChatInputChange}
                                />
                                <Button type="submit" size="sm">Send</Button>
                            </form>
                        </div>
                    </div>
                </ResizablePanel>
                <ResizableHandle withHandle />
                {/* Existing Workflow Panel */}
                <ResizablePanel defaultSize={40} minSize={20}>
                    {/* File Selection Step */}
                    {currentStep === 'selecting' && (
                        <div className="p-4">
                            <div className="mb-4 flex-col">
                                <h3 className="text-lg font-semibold">Select Files for Analysis</h3>

                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                                Choose which files you want to analyze and extract data from. You can select multiple files.
                            </p>

                            <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
                                {displayFiles.map((file: JobFile, index: number) => (
                                    <Card key={file._id} className={`cursor-pointer transition-colors p-0 ${selectedFileIndices.includes(index) ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                                        }`} onClick={() => toggleFileSelection(index)}>
                                        <CardContent className="p-3">
                                            <div className="flex items-start justify-between">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <FileText className="w-4 h-4 text-gray-600" />
                                                        <h4 onClick={(e) => { e.stopPropagation(); setPreviewFileIndex(index); }} className="font-medium truncate max-w-xs cursor-pointer text-blue-700 hover:underline" title="View file">{file.fileName}</h4>
                                                    </div>
                                                    {file.documentType && (
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <Badge variant="secondary" className="text-xs truncate" title={file.documentType}>{file.documentType}</Badge>
                                                            {file.pageNumbers && (
                                                                <span className="text-xs text-muted-foreground">pages: {Array.isArray(file.pageNumbers) ? file.pageNumbers.join(',') : file.pageNumbers}</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${selectedFileIndices.includes(index) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                                                    }`}>
                                                    {selectedFileIndices.includes(index) && (
                                                        <CheckCircle className="w-3 h-3 text-white" />
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                            <div className="space-y-3">
                                {/* Split & Classify button */}
                                {(() => {
                                    const anyClassified = jobDetails && jobDetails.files.some(f=>f.documentType);
                                    if (anyClassified) return null; // hide once classified docs exist
                                    if (isClassifying) return (
                                        <div className="flex items-center gap-2 py-2"><Loader2 className="w-4 h-4 animate-spin"/><span className="text-sm">Classifying...</span></div>
                                    );
                                    return <Button className="w-full" disabled={isProcessing} onClick={async () => {
                                        if (!jobDetails) return;
                                        setIsProcessing(true);
                                        setIsClassifying(true);
                                        try {
                                            const originalsToUse = selectedFileIndices.length
                                                ? selectedFileIndices.filter(i => !jobDetails.files[i].documentType)
                                                : jobDetails.files.map((_, i) => i).filter(i => !jobDetails.files[i].documentType);
                                            const fileUrls = originalsToUse.map(i => jobDetails.files[i].fileUrl).filter(Boolean);
                                            if (fileUrls.length === 0) { alert('Please select original files to split'); setIsProcessing(false); return; }
                                            // Clear selection to wait for new files
                                            setSelectedFileIndices([]);
                                            await fetch('/api/classify', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ jobId: jobDetails.job._id, fileUrls })
                                            });
                                        } catch (err) { console.error(err); alert('Split & classify failed'); }
                                        finally { setIsProcessing(false); setIsClassifying(false); }
                                    }}>Split & Classify</Button>
                                })()}

                                {/* Analyze button */}
                                {(() => {
                                    const canAnalyze = selectedFileIndices.length > 0 && selectedFileIndices.every(i => displayFiles[i]?.documentType);
                                    if (!canAnalyze) return null;
                                    return <Button
                                        onClick={confirmFileSelection}
                                        disabled={isProcessing}
                                        className="w-full"
                                    >
                                        {isProcessing ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                Starting Analysis...
                                            </>
                                        ) : (
                                            `Analyse ${selectedFileIndices.length} Selected File${selectedFileIndices.length !== 1 ? 's' : ''}`
                                        )}
                                    </Button>
                                })()}

                                <p className="text-xs text-center text-muted-foreground">
                                    selected {selectedFileIndices.length} of {displayFiles.length} files
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Analysis Step */}
                    {currentStep === 'analyzing' && (
                        <div className="p-6">
                            <div className="text-center">
                                <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
                                <h3 className="text-lg font-semibold mb-2">Analyzing Document{selectedFileIndices.length !== 1 ? 's' : ''}</h3>
                                <p className="text-sm text-muted-foreground">
                                    AI is examining {selectedFileIndices.length} document{selectedFileIndices.length !== 1 ? 's' : ''} and suggesting fields for extraction...
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Field Confirmation Step */}
                    {currentStep === 'confirming' && analysisResult && (
                        <div className="h-full flex flex-col p-4 py-2">
                            <div className="mb-2 flex items-center gap-2 flex-shrink-0">
                                <h3 className="text-lg font-semibold">Confirm Fields to Extract</h3>
                                <span
                                    title={analysisResult.notes}
                                >
                                    <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                                </span>
                            </div>

                            {templateOptions.length > 0 && (
                                <div className="mb-2 flex-shrink-0">
                                    <label className="text-sm font-medium mb-1 block">Template Suggestions</label>
                                    <Select value={selectedTemplateId || ''} onValueChange={handleTemplateSelect}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Choose a template" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {templateOptions.map(t => (
                                                <SelectItem key={t.templateId} value={t.templateId}>
                                                    {t.supplier}{t.clientName ? ` - ${t.clientName}` : ''} ({Math.round((t.score || 0) * 100)}%)
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            <div className="mb-3 border-b flex gap-4 text-sm font-medium flex-shrink-0">
                                <button
                                    className={`pb-2 ${fieldsTab === 'header' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-blue-600'}`}
                                    onClick={() => setFieldsTab('header')}
                                >
                                    Invoice Header Fields
                                </button>
                                <button
                                    className={`pb-2 ${fieldsTab === 'line' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-blue-600'}`}
                                    onClick={() => setFieldsTab('line')}
                                >
                                    Line Item Fields
                                </button>
                            </div>

                            {/* Table container - takes remaining space */}
                            <div className="flex-1 min-h-0 mb-3">
                                <div className="h-full border rounded overflow-hidden">
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
                                    </table>
                                    <div className="h-full overflow-y-auto">
                                        <table className="w-full text-sm table-fixed">
                                            <tbody>
                                                {(fieldsTab === 'header' ? analysisResult.headerFields : analysisResult.lineItemFields).map((field) => {
                                                    const selected = confirmedFields.some(f => f.name === field.name);
                                                    const fieldLabel = confirmedFields.find(f => f.name === field.name)?.label || field.label;
                                                    return (
                                                        <tr key={field.name} className={selected ? 'bg-gray-50' : 'hover:bg-gray-25'}>
                                                            <td className="w-12 p-2 border-b align-top text-center">
                                                                <div
                                                                    onClick={() => handleFieldToggle(field.name)}
                                                                    className={`w-4 h-4 rounded border-2 mt-1 flex items-center justify-center cursor-pointer mx-auto ${selected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}
                                                                >
                                                                    {selected && <CheckCircle className="w-3 h-3 text-white" />}
                                                                </div>
                                                            </td>
                                                            <td className="w-40 p-2 border-b align-top">
                                                                <div
                                                                    contentEditable
                                                                    suppressContentEditableWarning
                                                                    onBlur={(e) => handleLabelChange(field.name, e.currentTarget.textContent || '')}
                                                                    className="font-medium outline-none focus:ring-0 border border-transparent rounded px-1 hover:border-gray-300 focus:border-blue-500 truncate"
                                                                    title={fieldLabel}
                                                                >
                                                                    {fieldLabel}
                                                                </div>
                                                            </td>
                                                            <td className="w-20 p-2 border-b align-top">
                                                                <Badge variant="outline" className="text-xs truncate" title={field.type}>
                                                                    {field.type == "string" ? "Text" : field.type == "number" ? "Number" : field.type == "date" ? "Date" : field.type}
                                                                </Badge>
                                                            </td>
                                                            <td className="w-20 p-2 border-b align-top text-center">
                                                                {field.required && (
                                                                    <p className="font-bold">✓</p>
                                                                )}
                                                            </td>
                                                            <td className="p-2 border-b align-top">
                                                                <div
                                                                    className="text-xs text-muted-foreground truncate cursor-help"
                                                                    title={field.description}
                                                                >
                                                                    {field.description}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Add Field Buttons / Forms - fixed at bottom */}
                            <div className="flex-shrink-0 mb-3">
                                {fieldsTab === 'header' ? (
                                    showAddHeader ? (
                                        <div className="border rounded p-2 space-y-2">
                                            <Input placeholder="Field label" value={newHeaderField.label} onChange={(e) => setNewHeaderField({ ...newHeaderField, label: e.target.value })} />
                                            <Select value={newHeaderField.type} onValueChange={(val) => setNewHeaderField({ ...newHeaderField, type: val as any })}>
                                                <SelectTrigger className="w-full">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="string">String</SelectItem>
                                                    <SelectItem value="number">Number</SelectItem>
                                                    <SelectItem value="date">Date</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Input placeholder="Description (optional)" value={newHeaderField.description} onChange={(e) => setNewHeaderField({ ...newHeaderField, description: e.target.value })} />
                                            <label className="text-xs flex items-center gap-2">
                                                <input type="checkbox" checked={newHeaderField.required} onChange={(e) => setNewHeaderField({ ...newHeaderField, required: e.target.checked })} /> Required
                                            </label>
                                            <div className="flex gap-2">
                                                <Button size="sm" onClick={() => addCustomField('header')}>Add</Button>
                                                <Button size="sm" variant="outline" onClick={() => setShowAddHeader(false)}>Cancel</Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <Button variant="ghost" size="sm" onClick={() => setShowAddHeader(true)}>+ Add Header Field</Button>
                                    )
                                ) : (
                                    showAddLine ? (
                                        <div className="border rounded p-2 space-y-2">
                                            <Input placeholder="Field label" value={newLineField.label} onChange={(e) => setNewLineField({ ...newLineField, label: e.target.value })} />
                                            <Select value={newLineField.type} onValueChange={(val) => setNewLineField({ ...newLineField, type: val as any })}>
                                                <SelectTrigger className="w-full">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="string">String</SelectItem>
                                                    <SelectItem value="number">Number</SelectItem>
                                                    <SelectItem value="date">Date</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Input placeholder="Description (optional)" value={newLineField.description} onChange={(e) => setNewLineField({ ...newLineField, description: e.target.value })} />
                                            <label className="text-xs flex items-center gap-2">
                                                <input type="checkbox" checked={newLineField.required} onChange={(e) => setNewLineField({ ...newLineField, required: e.target.checked })} /> Required
                                            </label>
                                            <div className="flex gap-2">
                                                <Button size="sm" onClick={() => addCustomField('line')}>Add</Button>
                                                <Button size="sm" variant="outline" onClick={() => setShowAddLine(false)}>Cancel</Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <Button variant="ghost" size="sm" onClick={() => setShowAddLine(true)}>+ Add Line Field</Button>
                                    )
                                )}
                            </div>

                            {/* Action buttons - fixed at bottom */}
                            <div className="space-y-3 flex-shrink-0">
                                {supplierName && (
                                    <Button
                                        variant="outline"
                                        onClick={handleSaveTemplate}
                                        disabled={isSavingTemplate || confirmedFields.length === 0}
                                        className="w-full"
                                    >
                                        {isSavingTemplate ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                Saving Template...
                                            </>
                                        ) : templateFound ? 'Update Template' : 'Save as Template'}
                                    </Button>
                                )}
                                <Button
                                    onClick={confirmFields}
                                    disabled={confirmedFields.length === 0 || isProcessing}
                                    className="w-full"
                                >
                                    {isProcessing ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                            Extracting Data...
                                        </>
                                    ) : (
                                        `Extract ${confirmedFields.length} Field${confirmedFields.length !== 1 ? 's' : ''}`
                                    )}
                                </Button>

                                <p className="text-xs text-center text-muted-foreground">
                                    Selected {confirmedFields.length} of {analysisResult.headerFields.length + analysisResult.lineItemFields.length} fields
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Extracting Step */}
                    {currentStep === 'extracting' && (
                        <div className="p-6">
                            <div className="text-center">
                                <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
                                <h3 className="text-lg font-semibold mb-2">Extracting Data</h3>
                                <p className="text-sm text-muted-foreground">
                                    AI is extracting {confirmedFields.length} fields from {selectedFileIndices.length} document{selectedFileIndices.length !== 1 ? 's' : ''}...
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Review Step */}
                    {currentStep === 'reviewing' && (
                        <div className="p-4 h-full overflow-y-auto">
                            <div className="mb-4">
                                <h3 className="text-lg font-semibold">Review Extracted Data</h3>
                                <p className="text-sm text-muted-foreground">
                                    Verify the extracted data and make any necessary corrections.
                                </p>
                            </div>

                            <div className="space-y-4">
                                {Array.isArray(extractedData?.documents) ? (
                                    // Multiple files - show each document's data
                                    <div className="space-y-6">
                                        {(extractedData as { documents: any[] }).documents.map((docData: any, index: number) => {
                                            const selectedFile = files[selectedFileIndices[index]];
                                            return (
                                                <div key={index} className="border rounded-lg p-4 space-y-2">
                                                    <div className="mb-1">
                                                        <h4 className="font-medium text-sm">Document {index + 1}: {selectedFile?.fileName || `File ${index + 1}`}</h4>
                                                        <p className="text-xs text-muted-foreground">Size: {Math.round((selectedFile?.fileSize || 0) / 1024)}KB</p>
                                                    </div>
                                                    <DataTable
                                                        headerData={docData.header}
                                                        lineItemsData={docData.lineItems}
                                                        headerFields={analysisResult?.headerFields ?? []}
                                                        lineItemFields={analysisResult?.lineItemFields ?? []}
                                                        onChange={(updated: any) => {
                                                            const current = extractedData as { documents: any[] };
                                                            const newDocs = [...current.documents];
                                                            newDocs[index] = updated;
                                                            handleDataChange({ documents: newDocs });
                                                        }}
                                                        onExportCSV={handleExportCSV}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    // Single file - show data directly
                                    <DataTable
                                        headerData={(extractedData as any).header}
                                        lineItemsData={(extractedData as any).lineItems}
                                        headerFields={analysisResult?.headerFields ?? []}
                                        lineItemFields={analysisResult?.lineItemFields ?? []}
                                        onChange={(updated: any) => handleDataChange(updated)}
                                        onExportCSV={handleExportCSV}
                                    />
                                )}

                                <div className="space-y-2">
                                    <Button
                                        onClick={completeJobWithExtractedData}
                                        disabled={isProcessing}
                                        className="w-full"
                                    >
                                        {isProcessing ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                Completing Job...
                                            </>
                                        ) : (
                                            'Complete Job'
                                        )}
                                    </Button>

                                    <p className="text-xs text-center text-muted-foreground">
                                        This will mark the job as completed and submit the extracted data.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Completed Step */}
                    {currentStep === 'completed' && (
                        <div className="p-6">
                            <div className="text-center">
                                <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-600" />
                                <h3 className="text-lg font-semibold mb-2">Job Completed!</h3>
                                <p className="text-sm text-muted-foreground">
                                    Data has been successfully extracted and submitted. Redirecting to dashboard...
                                </p>
                            </div>
                        </div>
                    )}
                </ResizablePanel>

                <ResizableHandle withHandle />
                {/* Document Preview */}
                <ResizablePanel defaultSize={40} minSize={25}>
                    {/* Use filtered displayFiles so originals are hidden in preview selection */}
                    <DocumentView files={displayFiles} previewIndex={previewFileIndex} onPreviewChange={setPreviewFileIndex} />
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
} 