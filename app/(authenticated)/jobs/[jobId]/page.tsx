/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api as convexApi } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import TimeRemaining from "@/components/TimeRemaining";
import { CheckCircle, AlertCircle, Loader2, FileText, Info, Paperclip, ChevronDown } from "lucide-react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useChat } from "@ai-sdk/react";
import Markdown from "@/components/Markdown";
import DocumentView from "./documentView";
import { Label } from "@/components/ui/label";
import { Loader2 as NewLoader2 } from "lucide-react";
import { useState as useLocalState, useEffect as useLocalEffect } from 'react';

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

interface ToolInvocationProps {
    invocation: any;
}

const ToolInvocationDisplay: React.FC<ToolInvocationProps> = ({ invocation }) => {
    const [open, setOpen] = useState(false);
    if (invocation.state === 'calling' || invocation.state === 'partial-call') {
        return (
            <div className="text-xs text-gray-400 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Running <code>{invocation.toolName}</code>...
            </div>
        );
    }
    if (invocation.state === 'error') {
        return (
            <div className="text-xs text-red-600">{invocation.error}</div>
        );
    }
    if (invocation.state === 'result') {
        // Create a more user-friendly display name for the tool result
        const getResultDisplayName = (toolName: string) => {
            if (toolName?.includes('extract_shipment')) return 'extract_mode result';
            if (toolName?.includes('extract_consignor')) return 'extract_consignor result';
            if (toolName?.includes('extract_consignee')) return 'extract_consignee result';
            if (toolName?.includes('extract_n10')) return 'extract_n10 result';
            return `${toolName} result`;
        };

        return (
            <div className="mt-2">
                <button 
                    onClick={() => setOpen(!open)} 
                    className="text-blue-600 hover:underline focus:outline-none text-sm font-medium"
                >
                    View {getResultDisplayName(invocation.toolName)}
                </button>
                {open && (
                    <div className="bg-gray-50 p-3 mt-2 rounded-md text-xs overflow-x-auto border border-gray-200">
                        <pre className="whitespace-pre-wrap">
                            {JSON.stringify(invocation.result, null, 2)}
                        </pre>
                    </div>
                )}
            </div>
        );
    }
    return null;
};

const FilePill: React.FC<{ name: string }> = ({ name }) => (
    <span className="inline-flex items-center gap-1 bg-gray-200 text-gray-800 rounded-full px-2 py-0.5 text-[10px] mr-1 mt-1">
        <FileText className="w-3 h-3" /> {name}
    </span>
);

export default function JobCursorPage(props: any) {
    // Next.js 15: params is a Promise in client components – unwrap it
    const params = React.use(props.params) as { jobId: string };
    const jobId = params.jobId as Id<"jobs">;

    // Job details (files, title, deadline)
    const jobDetails = useQuery(convexApi.jobs.getDetails, { jobId });
    const completeJob = useMutation(convexApi.jobs.completeJob);
    const generateUploadUrl = useMutation(convexApi.jobs.generateUploadUrl);
    const updateStep = useMutation(convexApi.jobs.updateCompilerStep);
    const router = useRouter();

    // Recent jobs for switcher dropdown
    const myActiveJobs = useQuery(convexApi.jobs.getMyActive);
    const clientJobs = useQuery(convexApi.jobs.getForClient);
    const allJobs = useQuery(convexApi.jobs.getAll);

    // Job switcher state
    const [jobSwitcherOpen, setJobSwitcherOpen] = useState(false);

    // Extraction results - moved before useChat to avoid declaration order issues
    const [shipmentData, setShipmentData] = useState<any | null>(null);
    const [n10Data, setN10Data] = useState<any | null>(null);
    const [cpQuestionsData, setCpQuestionsData] = useState<any | null>(null);
    const [isExtracting, setIsExtracting] = useState(false);
    const [activeDataType, setActiveDataType] = useState<'shipment' | 'n10' | 'cp'>('shipment');
    const [extractionType, setExtractionType] = useState<'shipment' | 'n10' | null>(null);

    // Chat persistence
    const persistedMessages = useQuery(convexApi.chat.getForJob, { jobId });
    const initialChatMessages = persistedMessages ?? undefined;

    // AI chat hook
    const {
        messages: chatMessages,
        input: chatInput,
        handleInputChange,
        handleSubmit,
        isLoading,
        append,
    } = useChat({
        api: "/api/job-chat",
        initialMessages: initialChatMessages,
        sendExtraMessageFields: true, // Send id and createdAt for each message
        body: { 
            jobId, 
            shipmentContext: shipmentData // Pass shipment context for N10 extraction
        },
    });

    // Helper to programmatically set chat input (for attachment tokens)
    const setChatInput = (val: string) => handleInputChange({ target: { value: val } } as any);

    // Files queued for the next request
    const [queuedFileUrls, setQueuedFileUrls] = useState<string[]>([]);

    // Preview index for DocumentView
    const [previewIndex, setPreviewIndex] = useState(0);

    // Mention/autocomplete state
    const [mentionActive, setMentionActive] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionIndex, setMentionIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement | null>(null);

    // Display files (classified or originals) - moved before early returns
    const displayFiles: JobFile[] = useMemo(() => {
        if (!jobDetails) return [];
        return (jobDetails.files as JobFile[]);
    }, [jobDetails]);

    // suggestions computed - moved before early returns
    const mentionSuggestions = useMemo(() => {
        if (!mentionActive) return [] as (JobFile & { isAll?: boolean })[];
        const q = mentionQuery.toLowerCase();
        
        const allFilesAndRegularFiles: (JobFile & { isAll?: boolean })[] = [...displayFiles];
        if (displayFiles.length > 1) {
            allFilesAndRegularFiles.unshift({
                _id: 'all-files-pseudo-id',
                fileName: 'All Files',
                isAll: true,
            });
        }
        
        return allFilesAndRegularFiles.filter(f => f.fileName.toLowerCase().includes(q));
    }, [mentionActive, mentionQuery, displayFiles]);

    // Get recent jobs based on user role (including current job) - moved before early returns
    const recentJobs = useMemo(() => {
        let jobs: any[] = [];
        
        // Always provide fallback empty arrays to prevent undefined checks from changing hook order
        const activeJobs = myActiveJobs || [];
        const clientJobsList = clientJobs || [];
        const allJobsList = allJobs || [];
        
        console.log('🔍 Job data debugging:', {
            myActiveJobs: myActiveJobs?.length || 0,
            clientJobs: clientJobs?.length || 0,
            allJobs: allJobs?.length || 0,
            activeJobs: activeJobs.length,
            clientJobsList: clientJobsList.length,
            allJobsList: allJobsList.length
        });
        
        if (activeJobs.length > 0) {
            // Compiler: show active jobs
            jobs = activeJobs;
            console.log('✅ Using active jobs:', jobs.length);
        } else if (clientJobsList.length > 0) {
            // Client: show recent jobs
            jobs = clientJobsList;
            console.log('✅ Using client jobs:', jobs.length);
        } else if (allJobsList.length > 0) {
            // Admin: show recent jobs
            jobs = allJobsList;
            console.log('✅ Using all jobs:', jobs.length);
        } else {
            console.log('⚠️ No jobs found in any category');
        }
        
        // Include all jobs and limit to 10
        const result = jobs.slice(0, 10);
        console.log('📋 Final recent jobs:', result.map(j => ({ id: j._id, title: j.title })));
        return result;
    }, [myActiveJobs, clientJobs, allJobs]);

    // Sync data from persisted job record
    useEffect(() => {
        if (jobDetails?.job?.shipmentRegistrationExtractedData) {
            setShipmentData(jobDetails.job.shipmentRegistrationExtractedData);
        }
        if (jobDetails?.job?.n10extractedData) {
            setN10Data(jobDetails.job.n10extractedData);
            // Extract CP questions from N10 data if they exist
            if (jobDetails.job.n10extractedData?.lodgement_questions) {
                setCpQuestionsData(jobDetails.job.n10extractedData.lodgement_questions);
            }
        }
    }, [jobDetails]);

    // Auto-switch to the data type that has data (when only one type exists)
    useEffect(() => {
        if (shipmentData && !n10Data && !cpQuestionsData) {
            setActiveDataType('shipment');
        } else if (!shipmentData && n10Data && !cpQuestionsData) {
            setActiveDataType('n10');
        } else if (!shipmentData && !n10Data && cpQuestionsData) {
            setActiveDataType('cp');
        }
    }, [shipmentData, n10Data, cpQuestionsData]);

    // Determine extracting state based on compilerStep and presence of extracted data in DB
    useEffect(() => {
        if (!jobDetails) return;

        const { job } = jobDetails;

        if (job.compilerStep === 'extracting' && !job.shipmentRegistrationExtractedData && !job.n10extractedData) {
            setIsExtracting(true);

            // Check chat history to determine which extraction is likely running
            let detectedType: 'shipment' | 'n10' | null = null;
            // Iterate backwards through messages to find the most recent tool call
            for (const message of [...chatMessages].reverse()) {
                if (message.toolInvocations) {
                    for (const ti of message.toolInvocations) {
                        if (ti.toolName?.startsWith('extract_n10_')) {
                            detectedType = 'n10';
                            break;
                        }
                        if (ti.toolName?.startsWith('extract_')) {
                            detectedType = 'shipment';
                            break;
                        }
                    }
                }
                if (detectedType) break;
            }
            setExtractionType(detectedType);
            } else {
            setIsExtracting(false);
            setExtractionType(null);
        }
    }, [jobDetails, chatMessages]);

    // Ensure preview index resets if files list changes
    useEffect(() => {
        if (previewIndex >= displayFiles.length) {
            setPreviewIndex(0);
        }
    }, [displayFiles]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Check if the click is outside the job switcher
            const target = event.target as Element;
            const jobSwitcherElement = target.closest('[data-job-switcher]');
            if (!jobSwitcherElement && jobSwitcherOpen) {
                setJobSwitcherOpen(false);
            }
        };

        if (jobSwitcherOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [jobSwitcherOpen]);

    // Handle chat submit to include queued file URLs
    const onChatSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (isLoading || !chatInput.trim()) return;
        
        append(
            { role: 'user', content: chatInput, fileUrls: queuedFileUrls } as any,
            { body: { jobId, fileUrls: queuedFileUrls } }
        );

        setChatInput('');
        setQueuedFileUrls([]);
    };

    // Handler for quick action buttons
    const handleQuickAction = async (prompt: string) => {
        if (isLoading) return;
        await append(
            { role: 'user', content: prompt, fileUrls: queuedFileUrls } as any,
            { body: { jobId, fileUrls: queuedFileUrls } }
        );
        setQueuedFileUrls([]);
    };

    // Attaches all available files to the chat
    const attachAllFiles = () => {
        const allUrls = displayFiles.map(f => f.fileUrl).filter((url): url is string => !!url);
        // Add only urls that are not already queued
        const newUrls = allUrls.filter(url => !queuedFileUrls.includes(url));
        setQueuedFileUrls(prev => [...prev, ...newUrls]);

        const cleaned = chatInput.replace(/@([^\s]*)$/, '').trimEnd();
        setChatInput((cleaned + ' ').trimEnd());
        setMentionActive(false);
    };

    // When user drags a file onto chat or clicks attach
    const attachFile = (url: string, fileName: string) => {
        if (!url || queuedFileUrls.includes(url)) return;
        setQueuedFileUrls((prev) => [...prev, url]);
        // remove any unfinished mention
        const cleaned = chatInput.replace(/@[^\s]*$/, '').trimEnd();
        setChatInput((cleaned + ' ').trimEnd());
        setMentionActive(false);
    };

    // input change handler wrapper
    const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleInputChange(e);
        const value = e.target.value;
        const caret = e.target.selectionStart || value.length;
        // find last @ before caret without whitespace between
        const sub = value.slice(0, caret);
        const atMatch = sub.match(/@([^\s]*)$/);
        if (atMatch) {
            setMentionActive(true);
            setMentionQuery(atMatch[1]);
            } else {
            setMentionActive(false);
            setMentionQuery('');
        }
        setMentionIndex(0);
    };

    const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (mentionActive && mentionSuggestions.length) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMentionIndex((mentionIndex + 1) % mentionSuggestions.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMentionIndex((mentionIndex - 1 + mentionSuggestions.length) % mentionSuggestions.length);
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                const selection = mentionSuggestions[mentionIndex];
                if (selection) {
                    if (selection.isAll) {
                        attachAllFiles();
                    } else {
                        attachFile(selection.fileUrl || '', selection.fileName);
                    }
                }
            } else if (e.key === 'Escape') {
                setMentionActive(false);
            }
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

    // Section editor component
    const SectionEditor = ({ title, sectionKey, keys }: { title: string; sectionKey: string; keys: string[] }) => {
        const parent: any = shipmentData || {};
        const dataObj: any = parent[sectionKey] || {};
        const [localData, setLocalData] = useLocalState<Record<string, any>>(dataObj);
        const [editing, setEditing] = useLocalState<string | null>(null);
        const [temp, setTemp] = useLocalState('');

        // Keep localData in sync if shipmentData updates externally (e.g., after extraction)
        useLocalEffect(() => {
            console.log(`🔄 ${title} section updating:`, { 
                shipmentData, 
                sectionKey, 
                dataObj, 
                keys: keys.slice(0, 3) // Log first 3 keys for brevity
            });
            setLocalData(dataObj);
        }, [shipmentData]);

        const startEdit = (k: string) => {
            setEditing(k);
            setTemp(String(localData[k] ?? ''));
        };

        const finishEdit = async (k: string) => {
            const newVal = temp.trim() === '' ? null : temp;
            const updated = { ...localData, [k]: newVal };
            setLocalData(updated);
            const merged = { ...parent, [sectionKey]: updated };
            setShipmentData(merged);
            // persist
            try {
                await updateStep({ jobId, step: 'extracting', shipmentRegistrationExtractedData: merged });
        } catch (err) {
                console.error('save edit failed', err);
            }
            setEditing(null);
        };

        const fmt = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));

                                    return (
            <div className="mb-4">
                <h4 className="font-medium mb-1">{title}</h4>
                <table className="min-w-full table-fixed border border-gray-200 text-xs">
                    <colgroup>
                        <col style={{ width: '35%' }} />
                        <col style={{ width: '65%' }} />
                    </colgroup>
                    <tbody>
                        {keys.map((k) => (
                            <tr key={k} className="border-b last:border-b-0">
                                <td className="px-2 py-1 border-r bg-gray-50 font-medium whitespace-nowrap h-8 align-middle text-left truncate">{k}</td>
                                <td className="px-0 h-8 align-middle text-left">
                                    {editing === k ? (
                                <input
                                            className="w-96 h-8 bg-white px-2 focus:outline-none focus:ring-0 text-left"
                                            value={temp}
                                            onChange={(e) => setTemp(e.target.value)}
                                            onBlur={() => finishEdit(k)}
                                            autoFocus
                                        />
                                    ) : (
                                        <span
                                            className="flex items-center w-96 h-8 px-2 cursor-text text-left truncate whitespace-nowrap overflow-hidden"
                                            onClick={() => startEdit(k)}
                                            title={fmt(localData[k])}
                                        >
                                            {fmt(localData[k])}
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                                                </div>
        );
    };

    // New generic editor for N10 data, handles nested objects
    const N10ObjectEditor = ({ title, data, keys, onUpdate }: { title: string; data: any; keys: string[]; onUpdate: (newData: any) => void }) => {
        const [localData, setLocalData] = useLocalState<Record<string, any>>(data || {});
        const [editing, setEditing] = useLocalState<string | null>(null);
        const [temp, setTemp] = useLocalState('');
    
        useLocalEffect(() => {
            setLocalData(data || {});
        }, [data]);

        // Map user-friendly labels to schema field names
        const fieldMapping: Record<string, string> = {
            // Importer & Broker Details
            'Importer': 'importer_abn_ccid',
            'Importer ABN/CCID': 'importer_abn_ccid', 
            'Importer CAC': 'importer_cac',
            'Importer Reference': 'importer_ref',
            'Broker Reference': 'broker_ref',
            'Importer Declaration Identifier': 'importer_declaration_identifer',
            
            // Transport Details
            'Mode Of Transport': 'mode_of_transport',
            'IMO/Lloyds': 'vessel_id',
            'Voyage No': 'voyage_number',
            'Loading Port': 'loading_port',
            'Valuation Date': 'valuation_date',
            'First Arrival Port & Date': 'first_arrival_date',
            'Discharge Port': 'discharge_port',
            'Destination Port': 'destination_port',
            'Arrival Date': 'arrival_date',
            'Gross Weight': 'gross_weight',
            'Gross Weight Unit': 'gross_weight_unit',
            
            // Delivery Address (nested)
            'Name': 'name',
            'Address 1': 'address_1',
            'Address 2': 'address_2',
            'Locality': 'suburb',
            'State': 'state',
            'Country Code': 'country_code',
            'Postcode': 'postcode',
            
            // Bank Details
            'Bank Account Number': 'bank_account_number',
            'Bank Account Name': 'bank_account_name',
            'Bank Account BSB': 'bank_account_bsb',
            'Bank Account Owner Type': 'bank_account_owner_type',
            
            // Invoice Terms
            'Invoice Term Type': 'invoice_term_type',
            'EFT Payment Ind': 'is_eft_payment',
            'Self Assessed Clearance Ind': 'is_sac_declaration',
            'Pay Duty, Taxes, Charges': 'is_pay_duty',
            
            // Quarantine
            'Inspection Location': 'quarantine_inspection_location',
            'Concern Type': 'aqis_concern_type'
        };

        const getFieldName = (displayName: string) => fieldMapping[displayName] || displayName;
    
        const getNested = (obj: any, path: string) => path.split('.').reduce((o, i) => (o ? o[i] : null), obj);
    
        const setNested = (obj: any, path: string, value: any) => {
            const keys = path.split('.');
            let current = obj;
            for (let i = 0; i < keys.length - 1; i++) {
                if (current[keys[i]] === undefined || current[keys[i]] === null) {
                    current[keys[i]] = {};
                }
                current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = value;
            return obj;
        };
    
        const startEdit = (displayName: string) => {
            setEditing(displayName);
            const fieldName = getFieldName(displayName);
            setTemp(String(getNested(localData, fieldName) ?? ''));
        };
    
        const finishEdit = async (displayName: string) => {
            const fieldName = getFieldName(displayName);
            const newVal = temp.trim() === '' ? null : temp;
            const updated = setNested({ ...localData }, fieldName, newVal);
            setLocalData(updated);
            onUpdate(updated); // Callback to update parent state
            setEditing(null);
        };
    
        const fmt = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));
    
        return (
            <Card className="p-0 gap-0 border-0 shadow-none">
                <h1 className="p-2 font-medium text-sm">{title}</h1>
                <CardContent className="p-2">
                    <table className="min-w-full table-fixed border border-gray-200 text-xs">
                        <colgroup>
                            <col style={{ width: '35%' }} />
                            <col style={{ width: '65%' }} />
                        </colgroup>
                        <tbody>
                            {keys.map((k) => (
                                <tr key={k} className="border-b last:border-b-0">
                                    <td className="px-2 py-1 border-r bg-gray-50 font-medium whitespace-nowrap h-8 align-middle text-left truncate">{k}</td>
                                    <td className="px-0 h-8 align-middle text-left">
                                        {editing === k ? (
                                            <input
                                                className="w-96 h-8 bg-white px-2 focus:outline-none focus:ring-0 text-left"
                                                value={temp}
                                                onChange={(e) => setTemp(e.target.value)}
                                                onBlur={() => finishEdit(k)}
                                                autoFocus
                                            />
                                        ) : (
                                            <span
                                                className="flex items-center w-96 h-8 px-2 cursor-text text-left truncate whitespace-nowrap overflow-hidden"
                                                onClick={() => startEdit(k)}
                                                title={fmt(getNested(localData, getFieldName(k)))}
                                            >
                                                {fmt(getNested(localData, getFieldName(k)))}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </CardContent>
            </Card>
        );
    };

    // Read-only viewer for goods declaration list
    const N10GoodsDeclarationViewer = ({ items }: { items: any[] }) => {
        if (!items || items.length === 0) return null;
        const headers = Object.keys(items[0]);
        return (
            <Card className="p-0 gap-0 border-0 shadow-none">
                <h1 className="p-2 font-medium text-sm">Goods Declaration</h1>
                <CardContent className="p-2">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-xs">
                            <thead className="bg-gray-50">
                                <tr>
                                    {headers.map(key => (
                                        <th key={key} className="p-2 text-left font-medium truncate">{key}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item: any, index: number) => (
                                    <tr key={index} className="border-t">
                                        {headers.map(header => (
                                            <td key={`${index}-${header}`} className="p-2 truncate">{String(item[header] ?? '—')}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        );
    };

    // Component for displaying CP questions and lodgement questions
    const N10CPQuestionsViewer = ({ questions }: { questions: any[] }) => {
        if (!questions || questions.length === 0) return null;
        
        return (
            <Card className="p-0 gap-0 border-0 shadow-none">
                <h1 className="p-2 font-medium text-sm">CP Questions & Lodgement Questions</h1>
                <CardContent className="p-2">
                    <table className="min-w-full table-fixed border border-gray-200 text-xs">
                        <colgroup>
                            <col style={{ width: '25%' }} />
                            <col style={{ width: '75%' }} />
                        </colgroup>
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-2 py-1 border-r text-left font-medium">Question ID</th>
                                <th className="px-2 py-1 text-left font-medium">Answer</th>
                            </tr>
                        </thead>
                        <tbody>
                            {questions.map((question: any, index: number) => (
                                <tr key={index} className="border-b last:border-b-0">
                                    <td className="px-2 py-1 border-r bg-gray-50 font-medium whitespace-nowrap h-8 align-middle text-left truncate">
                                        {question.question_identifier || question.id || `Q${index + 1}`}
                                    </td>
                                    <td className="px-2 py-1 h-8 align-middle text-left">
                                        {question.answer || '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </CardContent>
            </Card>
        );
    };
    
    // Skeleton placeholder table used during extraction
    const SectionPlaceholder = ({ title, keys }: { title: string; keys: string[] }) => (
        <div className="mb-4">
            <h4 className="font-medium mb-1">{title}</h4>
            <table className="min-w-full table-fixed border border-gray-200 text-xs">
                <colgroup>
                    <col style={{ width: '35%' }} />
                    <col style={{ width: '65%' }} />
                </colgroup>
                <tbody>
                    {keys.map((k) => (
                        <tr key={k} className="border-b last:border-b-0">
                            <td className="px-2 py-1 border-r bg-gray-50 font-medium whitespace-nowrap h-8 align-middle text-left truncate">{k}</td>
                            <td className="px-2 h-8 align-middle text-left">—</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            </div>
        );

    const shipmentPlaceholderSections = [
        { title: 'Mode', keys: ['transport', 'container', 'type'] },
        { title: 'Consignor', keys: ['company', 'address', 'city_state', 'country'] },
        { title: 'Consignee', keys: ['company', 'address', 'city_state', 'country'] },
        { title: 'Details', keys: ['house_bill', 'domestic', 'origin', 'destination', 'etd', 'eta', 'weight_value', 'weight_unit', 'volume_value', 'volume_unit', 'chargeable_value', 'chargeable_unit', 'packages_count', 'packages_type', 'wv_ratio', 'inners_count', 'inners_type', 'goods_value_amount', 'goods_value_currency', 'insurance_value_amount', 'insurance_value_currency', 'description', 'marks_numbers', 'incoterm', 'free_on_board', 'spot_rate', 'spot_rate_type', 'use_standard_rate', 'service_level', 'release_type', 'charges_apply', 'phase', 'order_refs'] },
        { title: 'Customs', keys: ['aqis_status', 'customs_status', 'subject_to_aqis', 'subject_to_jfis'] },
    ];
    
    const n10FieldKeys = {
        importerBrokerDetails: ['Importer', 'Importer ABN/CCID', 'Importer CAC', 'Importer Reference', 'Broker Reference', 'Importer Declaration Identifier'],
        bankDetails: ['Bank Account Number', 'Bank Account Name', 'Bank Account BSB', 'Bank Account Owner Type'],
        transportDetails: ['Mode Of Transport', 'IMO/Lloyds', 'Voyage No', 'Loading Port', 'Valuation Date', 'First Arrival Port & Date', 'Discharge Port', 'Destination Port', 'Arrival Date', 'Gross Weight', 'Gross Weight Unit'],
        deliveryAddress: ['Name', 'Address 1', 'Address 2', 'Locality', 'State', 'Country Code', 'Postcode'],
        invoiceTerms: ['Invoice Term Type', 'EFT Payment Ind', 'Self Assessed Clearance Ind', 'Pay Duty, Taxes, Charges'],
        quarantine: ['Inspection Location', 'Concern Type'],
        valuationElements: ['Invoice Total', 'Overseas Freight', 'Overseas Insurance', 'Packing Costs', 'Foreign Inland Freight', 'Commission', 'Discount', 'Landing Charges', 'Other (Deductions)', 'Other (Additions)', 'Free On Board', 'Cost, Insurance & Freight'],
        transportLines: ['Master Waybill No', 'House Waybill No', 'No of Pkgs', 'Packing Unit Count', 'Marks & Nos Description', 'Visual Exam Ind'],
        cpQuestions: ['CP1', 'CP2', 'CP3', 'CP4', 'CP5', 'CP6', 'CP7', 'CP8', 'CP9', 'CP10'],
    };

    const n10PlaceholderSections = [
        { title: 'Importer & Broker Details', keys: ['importer', 'importerABN', 'importerCAC', 'importerReference', 'brokerReference', 'importerDeclarationIdentifier'] },
        { title: 'Bank Details', keys: ['bankAccountNumber', 'bankAccountName', 'bankAccountBSB', 'bankAccountOwnerType'] },
        { title: 'Transport Details', keys: ['modeOfTransport', 'imoLloyds', 'voyageNo', 'loadingPort', 'valuationDate', 'firstArrivalPortDate', 'dischargePort', 'destinationPort', 'arrivalDate', 'grossWeight', 'grossWeightUnit'] },
        { title: 'Delivery Address', keys: ['name', 'address1', 'address2', 'locality', 'state', 'countryCode', 'postcode'] },
        { title: 'Invoice Terms', keys: ['invoiceTermType', 'eftPaymentInd', 'selfAssessedClearanceInd', 'payDutyTaxesCharges'] },
        { title: 'Quarantine', keys: ['inspectionLocation', 'concernType'] },
        { title: 'Invoice Details', keys: ['supplier', 'valuationBasis', 'origin', 'gste', 'prefOrigin', 'prefSchemeType', 'prefRuleType', 'importPermitNumber', 'relatedTransactionIndicator'] },
    ];

    // Job Switcher Component
    const JobSwitcher = () => (
        <div className="relative" data-job-switcher>
            <button
                onClick={() => {
                    console.log('🔽 Job switcher button clicked, current state:', jobSwitcherOpen);
                    console.log('📊 Recent jobs count:', recentJobs.length);
                    console.log('📋 Recent jobs:', recentJobs.map(j => ({ id: j._id, title: j.title })));
                    setJobSwitcherOpen(!jobSwitcherOpen);
                }}
                className="flex items-center justify-center gap-3 px-6 py-1.5 text-center bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-96"
            >
                <span className="text-sm font-medium text-gray-900">
                    Job-{job._id.slice(-8)}
                </span>
                <span className="text-sm text-gray-600 truncate max-w-32">
                    {job.title}
                </span>
                <div className="text-xs text-gray-500">
                    <TimeRemaining deadline={job.deadline} />
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${jobSwitcherOpen ? 'rotate-180' : ''}`} />
            </button>

            {jobSwitcherOpen && recentJobs.length > 0 && (
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 w-[28rem] bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                    <div className="p-2">
                        {recentJobs.map((recentJob: any) => {
                            const isCurrentJob = recentJob._id === jobId;
                            return (
                                <button
                                    key={recentJob._id}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        console.log('🔄 Job switcher clicked:', {
                                            jobId: recentJob._id,
                                            title: recentJob.title,
                                            currentUrl: window.location.href,
                                            targetUrl: `/jobs/${recentJob._id}`
                                        });
                                        setJobSwitcherOpen(false);
                                        console.log('📍 Navigating to:', `/jobs/${recentJob._id}`);
                                        // Use Next.js router for navigation
                                        router.push(`/jobs/${recentJob._id}`);
                                    }}
                                    className="w-full flex items-center justify-between px-3 py-2 text-left rounded-md hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <span className={`text-sm font-medium ${isCurrentJob ? 'text-blue-600' : 'text-gray-900'}`}>
                                            Job-{recentJob._id.slice(-8)}
                                        </span>
                                        <span className="text-sm text-gray-600 truncate">
                                            {recentJob.title}
                                        </span>
                                    </div>
                                    {recentJob.deadline && (
                                        <div className="text-xs text-gray-500 flex-shrink-0">
                                            <TimeRemaining deadline={recentJob.deadline} />
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="bg-white border-b shadow-sm">
                {/* App Navigation */}
                <div className="px-4 py-3 border-b bg-gray-50">
                    <div className="relative flex items-center justify-between min-h-[40px]">
                        {/* Left: Back to Dashboard */}
                        <div className="flex items-center gap-2 z-10">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push('/dashboard')}
                                className="text-gray-600 hover:text-gray-800"
                            >
                                ← Back to Dashboard
                            </Button>
                            <span className="text-gray-400">|</span>
                            <span className="text-sm text-gray-600">Document Processing</span>
                        </div>
                        {/* Center: Job Switcher */}
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-0">
                            <JobSwitcher />
                        </div>
                        {/* Right: Export Button */}
                        <div className="z-10">
                        {(shipmentData || n10Data) && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                    try {
                                        // Determine which data to export based on active tab
                                        const dataToExport = activeDataType === 'shipment' ? shipmentData : n10Data;
                                        const filePrefix = activeDataType === 'shipment' ? 'shipment' : 'n10';
                                        
                                        if (!dataToExport) {
                                            alert("No data available for export");
                                            return;
                                        }

                                        const resp = await fetch("/api/export-csv", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ data: dataToExport, jobTitle: job.title }),
                                        });
                                        if (!resp.ok) {
                                            throw new Error("Failed to export CSV");
                                        }
                                        const blob = await resp.blob();
                                        const url = URL.createObjectURL(blob);
                                        const link = document.createElement("a");
                                        link.href = url;
                                        link.download = `${filePrefix}_${job._id}.csv`;
                                        document.body.appendChild(link);
                                        link.click();
                                        link.remove();
                                        URL.revokeObjectURL(url);
                                    } catch (err) {
                                        console.error(err);
                                        alert("CSV export failed");
                                    }
                                }}
                                className="shadow-sm"
                            >
                                Export CSV ({activeDataType === 'shipment' ? 'Shipment' : 'N10'})
                            </Button>
                        )}
                        </div>
                    </div>
                </div>
            </div>

            <ResizablePanelGroup direction="horizontal" className="flex-1">
                {/* Left – document preview */}
                <ResizablePanel defaultSize={25} minSize={15}>
                    <div className="h-full bg-white border-r flex flex-col">
                        {/* Document Preview Header */}
                        <div className="px-4 py-2 bg-gray-50 border-b">
                            <h2 className="text-sm font-medium text-gray-700">Document Preview</h2>
                        </div>
                        {/* Document Content */}
                        <div className="flex-1">
                            {displayFiles.length > 0 ? (
                                <DocumentView files={displayFiles} previewIndex={previewIndex} onPreviewChange={setPreviewIndex} />
                            ) : (
                                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No files</div>
                            )}
                        </div>
                    </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* Middle – output panel */}
                <ResizablePanel defaultSize={50} minSize={35}>
                    <div className="flex flex-col h-full bg-white border-x">
                        {/* Results Header */}
                        <div className="px-4 py-2 bg-blue-50 border-b">
                            <div className="flex items-center justify-between">
                                {/* Data type switcher moved to left, replacing "Extracted Data" title */}
                                <div className="relative">
                                    <div className="flex items-center gap-6">
                                        <button
                                            onClick={() => setActiveDataType('shipment')}
                                            className={`text-sm font-medium transition-colors duration-200 ${
                                                activeDataType === 'shipment'
                                                    ? 'text-blue-900'
                                                    : 'text-blue-600 hover:text-blue-800'
                                            }`}
                                        >
                                            Shipment Form
                                        </button>
                                        <button
                                            onClick={() => setActiveDataType('n10')}
                                            className={`text-sm font-medium transition-colors duration-200 ${
                                                activeDataType === 'n10'
                                                    ? 'text-blue-900'
                                                    : 'text-blue-600 hover:text-blue-800'
                                            }`}
                                        >
                                            N10 Form
                                        </button>
                                        <button
                                            onClick={() => setActiveDataType('cp')}
                                            className={`text-sm font-medium transition-colors duration-200 ${
                                                activeDataType === 'cp'
                                                    ? 'text-blue-900'
                                                    : 'text-blue-600 hover:text-blue-800'
                                            }`}
                                        >
                                            CP Questions
                                        </button>
                                    </div>
                                    {/* Sliding underline */}
                                    <div 
                                        className={`absolute bottom-0 h-0.5 bg-blue-900 transition-all duration-300 ease-in-out ${
                                            activeDataType === 'shipment' 
                                                ? 'left-0 w-[100px]' 
                                                : activeDataType === 'n10'
                                                ? 'left-[124px] w-[68px]'
                                                : 'left-[216px] w-[88px]'
                                        }`}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Content area */}
                        <div className="flex-1 overflow-y-auto bg-white">
                            {(() => {
                                // Determine what to show based on available data and active type
                                const hasShipmentData = !!shipmentData;
                                const hasN10Data = !!n10Data;
                                
                                // If extracting, show loading state
                                if (isExtracting) {
                                    const sections = extractionType === 'n10' ? n10PlaceholderSections : shipmentPlaceholderSections;
                                    const title = extractionType === 'n10' ? 'Extracting N10 Document...' : 'Extracting Shipment Data...';
                                    
                                    return (
                                        <div className="p-4 space-y-4 text-sm">
                                            <div className="flex items-center gap-2 mb-2">
                                                <h3 className="font-semibold">{title}</h3>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            </div>
                                            {sections.map(section => (
                                                <SectionPlaceholder key={section.title} title={section.title} keys={section.keys} />
                                            ))}
                                        </div>
                                    );
                                }
                                
                                // Show content based on active tab
                                if (activeDataType === 'shipment') {
                                    if (hasShipmentData) {
                                        return (
                                            <div className="p-4 space-y-4 text-sm">
                                                <SectionEditor title="Mode" sectionKey="mode" keys={['transport', 'container', 'type']} />
                                                <SectionEditor title="Consignor" sectionKey="consignor" keys={['company', 'address', 'city_state', 'country']} />
                                                <SectionEditor title="Consignee" sectionKey="consignee" keys={['company', 'address', 'city_state', 'country']} />
                                                <SectionEditor title="Details" sectionKey="details" keys={['house_bill', 'domestic', 'origin', 'destination', 'etd', 'eta', 'weight_value', 'weight_unit', 'volume_value', 'volume_unit', 'chargeable_value', 'chargeable_unit', 'packages_count', 'packages_type', 'wv_ratio', 'inners_count', 'inners_type', 'goods_value_amount', 'goods_value_currency', 'insurance_value_amount', 'insurance_value_currency', 'description', 'marks_numbers', 'incoterm', 'free_on_board', 'spot_rate', 'spot_rate_type', 'use_standard_rate', 'service_level', 'release_type', 'charges_apply', 'phase', 'order_refs']} />
                                                <SectionEditor title="Customs" sectionKey="customs_fields" keys={['aqis_status', 'customs_status', 'subject_to_aqis', 'subject_to_jfis']} />
                                            </div>
                                        );
                                    } else {
                                        return (
                                            <div className="h-full flex items-center justify-center text-muted-foreground">
                                                <div className="text-center">
                                                    <div className="text-lg font-medium mb-2">No Shipment Data</div>
                                                    <div className="text-sm">Use the AI Assistant to extract shipment form data from your documents.</div>
                                                </div>
                                            </div>
                                        );
                                    }
                                } else if (activeDataType === 'n10') {
                                    // N10 form
                                    if (hasN10Data) {
                                        const handleUpdate = async (updatedN10Data: any) => {
                                            setN10Data(updatedN10Data);
                                            try {
                                                await updateStep({ jobId, step: 'extracting', n10extractedData: updatedN10Data });
                                            } catch (err) {
                                                console.error('save N10 edit failed', err);
                                            }
                                        };
                                        return (
                                            <div className="p-4 space-y-6 text-sm">
                                                {/* Importer & Broker Details */}
                                                <N10ObjectEditor 
                                                    title="Importer & Broker Details" 
                                                    data={n10Data} 
                                                    keys={[
                                                        'Importer',
                                                        'Importer ABN/CCID', 
                                                        'Importer CAC', 
                                                        'Importer Reference', 
                                                        'Broker Reference', 
                                                        'Importer Declaration Identifier'
                                                    ]} 
                                                    onUpdate={handleUpdate} 
                                                />

                                                {/* Transport Details */}
                                                <N10ObjectEditor 
                                                    title="Transport Details" 
                                                    data={n10Data} 
                                                    keys={[
                                                        'Mode Of Transport',
                                                        'IMO/Lloyds',
                                                        'Voyage No',
                                                        'Loading Port',
                                                        'Valuation Date',
                                                        'First Arrival Port & Date',
                                                        'Discharge Port',
                                                        'Destination Port',
                                                        'Arrival Date',
                                                        'Gross Weight',
                                                        'Gross Weight Unit'
                                                    ]} 
                                                    onUpdate={handleUpdate} 
                                                />

                                                {/* Delivery Address */}
                                                <N10ObjectEditor 
                                                    title="Delivery Address" 
                                                    data={n10Data?.delivery_address || {}} 
                                                    keys={[
                                                        'Name',
                                                        'Address 1',
                                                        'Address 2',
                                                        'Locality',
                                                        'State',
                                                        'Country Code',
                                                        'Postcode'
                                                    ]} 
                                                    onUpdate={(updatedAddress) => handleUpdate({...n10Data, delivery_address: updatedAddress})} 
                                                />

                                                {/* Bank Details */}
                                                <N10ObjectEditor 
                                                    title="Bank Details" 
                                                    data={n10Data} 
                                                    keys={[
                                                        'Bank Account Number',
                                                        'Bank Account Name',
                                                        'Bank Account BSB',
                                                        'Bank Account Owner Type'
                                                    ]} 
                                                    onUpdate={handleUpdate} 
                                                />

                                                {/* Invoice Terms */}
                                                <N10ObjectEditor 
                                                    title="Invoice Terms" 
                                                    data={n10Data} 
                                                    keys={[
                                                        'Invoice Term Type',
                                                        'EFT Payment Ind',
                                                        'Self Assessed Clearance Ind',
                                                        'Pay Duty, Taxes, Charges'
                                                    ]} 
                                                    onUpdate={handleUpdate} 
                                                />

                                                {/* Quarantine */}
                                                <N10ObjectEditor 
                                                    title="Quarantine" 
                                                    data={n10Data} 
                                                    keys={[
                                                        'Inspection Location',
                                                        'Concern Type'
                                                    ]} 
                                                    onUpdate={handleUpdate} 
                                                />

                                                {/* Valuation Elements */}
                                                <Card className="p-0 gap-0 border-0 shadow-none">
                                                    <h1 className="p-2 font-medium text-sm">Valuation Elements</h1>
                                                    <CardContent className="p-2">
                                                        <table className="min-w-full text-xs border border-gray-200">
                                                            <thead className="bg-gray-50">
                                                                <tr>
                                                                    <th className="px-3 py-2 text-left font-medium border-r">TYPE</th>
                                                                    <th className="px-3 py-2 text-left font-medium border-r">AMOUNT</th>
                                                                    <th className="px-3 py-2 text-left font-medium">CURRENCY</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {[
                                                                    { type: 'Invoice Total', amount: n10Data?.invoice_total_amount, currency: n10Data?.invoice_total_currency },
                                                                    { type: 'Overseas Freight', amount: n10Data?.overseas_freight_amount, currency: n10Data?.overseas_freight_currency },
                                                                    { type: 'Overseas Insurance', amount: n10Data?.overseas_insurance_amount, currency: n10Data?.overseas_insurance_currency },
                                                                    { type: 'Packing Costs', amount: n10Data?.packing_cost_amount, currency: n10Data?.packing_cost_currency },
                                                                    { type: 'Foreign Inland Freight', amount: n10Data?.foreign_inland_freight_amount, currency: n10Data?.foreign_inland_freight_currency },
                                                                    { type: 'Commission', amount: n10Data?.commision_amount, currency: n10Data?.commision_currency },
                                                                    { type: 'Discount', amount: n10Data?.discount_amount, currency: n10Data?.discount_currency },
                                                                    { type: 'Landing Charges', amount: n10Data?.landing_charge_amount, currency: n10Data?.landing_charge_currency },
                                                                    { type: 'Other (Deductions)', amount: n10Data?.other_deduction_amount, currency: n10Data?.other_deduction_currency },
                                                                    { type: 'Other (Additions)', amount: n10Data?.other_additional_amount, currency: n10Data?.other_additional_currency },
                                                                    { type: 'Free On Board', amount: n10Data?.free_on_board_amount, currency: n10Data?.free_on_board_currency },
                                                                    { type: 'Cost, Insurance & Freight', amount: n10Data?.cost_insurance_freight_amount, currency: n10Data?.cost_insurance_freight_currency }
                                                                ].map((item, index) => (
                                                                    <tr key={index} className="border-t">
                                                                        <td className="px-3 py-2 border-r">{item.type}</td>
                                                                        <td className="px-3 py-2 border-r">{item.amount || '—'}</td>
                                                                        <td className="px-3 py-2">{item.currency || '—'}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </CardContent>
                                                </Card>

                                                {/* Transport Lines */}
                                                {n10Data?.transport_lines && n10Data.transport_lines.length > 0 && (
                                                    <Card className="p-0 gap-0 border-0 shadow-none">
                                                        <h1 className="p-2 font-medium text-sm">Transport Lines</h1>
                                                        <CardContent className="p-2">
                                                            <div className="overflow-x-auto">
                                                                <table className="min-w-full text-xs border border-gray-200">
                                                                    <thead className="bg-gray-50">
                                                                        <tr>
                                                                            <th className="px-2 py-1 text-left font-medium border-r">#</th>
                                                                            <th className="px-2 py-1 text-left font-medium border-r">Container Number</th>
                                                                            <th className="px-2 py-1 text-left font-medium border-r">Master Bill</th>
                                                                            <th className="px-2 py-1 text-left font-medium border-r">House Bill</th>
                                                                            <th className="px-2 py-1 text-left font-medium border-r">Packages</th>
                                                                            <th className="px-2 py-1 text-left font-medium border-r">Marks & Description</th>
                                                                            <th className="px-2 py-1 text-left font-medium">Visual Exam</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {n10Data.transport_lines.map((line: any, index: number) => (
                                                                            <tr key={index} className="border-t">
                                                                                <td className="px-2 py-1 border-r">{index + 1}</td>
                                                                                <td className="px-2 py-1 border-r">{line.container_number || '—'}</td>
                                                                                <td className="px-2 py-1 border-r">{line.masterbill || '—'}</td>
                                                                                <td className="px-2 py-1 border-r">{line.housebill || '—'}</td>
                                                                                <td className="px-2 py-1 border-r">{line.number_of_packages || '—'}</td>
                                                                                <td className="px-2 py-1 border-r">{line.marks_and_desc || '—'}</td>
                                                                                <td className="px-2 py-1">{line.is_visual_exam_indicator ? 'Yes' : 'No'}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                )}

                                                {/* Tariff Lines */}
                                                {n10Data?.tariff_lines && n10Data.tariff_lines.length > 0 && (
                                                    <Card className="p-0 gap-0 border-0 shadow-none">
                                                        <h1 className="p-2 font-medium text-sm">Tariff Lines</h1>
                                                        <CardContent className="p-2">
                                                            <div className="overflow-x-auto">
                                                                <table className="min-w-full text-xs border border-gray-200">
                                                                    <thead className="bg-gray-50">
                                                                        <tr>
                                                                            <th className="px-2 py-1 text-left font-medium border-r">#</th>
                                                                            <th className="px-2 py-1 text-left font-medium border-r">Goods Description</th>
                                                                            <th className="px-2 py-1 text-left font-medium border-r">Tariff Class</th>
                                                                            <th className="px-2 py-1 text-left font-medium border-r">Country of Origin</th>
                                                                            <th className="px-2 py-1 text-left font-medium border-r">Quantity</th>
                                                                            <th className="px-2 py-1 text-left font-medium border-r">Price Amount</th>
                                                                            <th className="px-2 py-1 text-left font-medium border-r">Currency</th>
                                                                            <th className="px-2 py-1 text-left font-medium">Preference Scheme</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {n10Data.tariff_lines.map((line: any, index: number) => (
                                                                            <tr key={index} className="border-t">
                                                                                <td className="px-2 py-1 border-r">{index + 1}</td>
                                                                                <td className="px-2 py-1 border-r">{line.good_desc || '—'}</td>
                                                                                <td className="px-2 py-1 border-r">{line.tariff_class_number || '—'}</td>
                                                                                <td className="px-2 py-1 border-r">{line.country_of_origin || '—'}</td>
                                                                                <td className="px-2 py-1 border-r">{line.quantity_1 || '—'} {line.quantity_1_unit || ''}</td>
                                                                                <td className="px-2 py-1 border-r">{line.type_price_amount || '—'}</td>
                                                                                <td className="px-2 py-1 border-r">{line.type_price_currency || '—'}</td>
                                                                                <td className="px-2 py-1">{line.preference_scheme_type || '—'}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                )}

                                                {/* Lodgement Questions */}
                                                {n10Data?.lodgement_questions && n10Data.lodgement_questions.length > 0 && (
                                                    <Card className="p-0 gap-0 border-0 shadow-none">
                                                        <h1 className="p-2 font-medium text-sm">Lodgement Questions</h1>
                                                        <CardContent className="p-2">
                                                            <table className="min-w-full table-fixed border border-gray-200 text-xs">
                                                                <colgroup>
                                                                    <col style={{ width: '30%' }} />
                                                                    <col style={{ width: '70%' }} />
                                                                </colgroup>
                                                                <thead className="bg-gray-50">
                                                                    <tr>
                                                                        <th className="px-2 py-1 border-r text-left font-medium">Question ID</th>
                                                                        <th className="px-2 py-1 text-left font-medium">Answer</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {n10Data.lodgement_questions.map((question: any, index: number) => (
                                                                        <tr key={index} className="border-b last:border-b-0">
                                                                            <td className="px-2 py-1 border-r bg-gray-50 font-medium whitespace-nowrap h-8 align-middle text-left truncate">
                                                                                {question.question_identifier || question.id || `Q${index + 1}`}
                                                                            </td>
                                                                            <td className="px-2 py-1 h-8 align-middle text-left">
                                                                                {question.answer || '—'}
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </CardContent>
                                                    </Card>
                                                )}
                                            </div>
                                        );
                                    } else {
                                        return (
                                            <div className="h-full flex items-center justify-center text-muted-foreground">
                                                <div className="text-center">
                                                    <div className="text-lg font-medium mb-2">No N10 Data</div>
                                                    <div className="text-sm mb-4">Use the AI Assistant to extract N10 form data from your documents.</div>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={async () => {
                                                            // Create empty N10 form structure
                                                            const emptyN10Data = {
                                                                importerBrokerDetails: {},
                                                                bankDetails: {},
                                                                transportDetails: {},
                                                                deliveryAddress: {},
                                                                invoiceTerms: {},
                                                                quarantine: {},
                                                                invoiceDetails: {},
                                                                goodsDeclaration: []
                                                            };
                                                            setN10Data(emptyN10Data);
                                                            try {
                                                                await updateStep({ jobId, step: 'extracting', n10extractedData: emptyN10Data });
                                                            } catch (err) {
                                                                console.error('Failed to create N10 form', err);
                                                            }
                                                        }}
                                                        className="shadow-sm"
                                                    >
                                                        Create N10 Form
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    }
                                } else {
                                    // CP Questions tab
                                    if (cpQuestionsData && cpQuestionsData.length > 0) {
                                        return (
                                            <div className="p-4 space-y-4 text-sm">
                                                <N10CPQuestionsViewer questions={cpQuestionsData} />
                                            </div>
                                        );
                                    } else {
                                        return (
                                            <div className="h-full flex items-center justify-center text-muted-foreground">
                                                <div className="text-center">
                                                    <div className="text-lg font-medium mb-2">No CP Questions Found</div>
                                                    <div className="text-sm">CP questions will appear here when they are extracted from documents that contain them.</div>
                                                </div>
                                            </div>
                                        );
                                    }
                                }
                            })()}
                                        </div>
                            </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* Right – files and chat */}
                <ResizablePanel defaultSize={25} minSize={15}>
                    <ResizablePanelGroup direction="vertical" className="h-full">
                        {/* Job Files */}
                        <ResizablePanel defaultSize={30} minSize={20}>
                            <div className="flex flex-col h-full bg-white border-l">
                                {/* File list header */}
                                <div className="px-3 py-2 border-b border-gray-200">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-base font-semibold text-gray-900">Files</h3>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-xs h-7 px-3 border-blue-200 text-blue-600 hover:bg-blue-50"
                                            onClick={attachAllFiles}
                                            disabled={displayFiles.length === 0}
                                        >
                                            Attach All
                                        </Button>
                                    </div>
                                </div>
                                {/* File list content */}
                                <div className="p-2 space-y-2 overflow-y-auto">
                                    {displayFiles.map((file, idx) => {
                                        const isQueued = queuedFileUrls.includes(file.fileUrl || "");
                                        return (
                                            <div
                                                key={file._id}
                                                className="bg-blue-50 border border-blue-200 rounded-lg p-2 transition-colors hover:bg-blue-100"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div
                                                        draggable
                                                        onDragStart={(e) => e.dataTransfer.setData("text/uri-list", file.fileUrl || "")}
                                                        className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
                                                        onClick={() => setPreviewIndex(idx)}
                                                        title={file.fileName}
                                                    >
                                                        <Paperclip className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                                        <span className="text-sm font-medium text-gray-900 truncate">{file.fileName}</span>
                                                    </div>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="text-xs h-6 px-2 ml-2 border-blue-300 text-blue-700 hover:bg-blue-200 flex-shrink-0"
                                                        onClick={() => {
                                                            if (isQueued) {
                                                                setQueuedFileUrls(prev => prev.filter(url => url !== file.fileUrl));
                                                            } else {
                                                                attachFile(file.fileUrl || "", file.fileName);
                                                            }
                                                        }}
                                                        title={isQueued ? "Remove from chat" : "Attach to chat"}
                                                    >
                                                        {isQueued ? "✓" : "Attach"}
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </ResizablePanel>

                        <ResizableHandle withHandle />

                        {/* AI Assistant */}
                        <ResizablePanel defaultSize={70} minSize={50}>
                            <div className="flex flex-col h-full bg-white">
                                {/* Chat header */}
                                <div className="px-4 py-2 bg-white border-b border-gray-200">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
                                            <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M12,2A2,2 0 0,1 14,4C14,4.74 13.6,5.39 13,5.73V7H14A7,7 0 0,1 21,14H22A1,1 0 0,1 23,15V18A1,1 0 0,1 22,19H21V20A2,2 0 0,1 19,22H5A2,2 0 0,1 3,20V19H2A1,1 0 0,1 1,18V15A1,1 0 0,1 2,14H3A7,7 0 0,1 10,7H11V5.73C10.4,5.39 10,4.74 10,4A2,2 0 0,1 12,2M12,4A0.5,0.5 0 0,0 11.5,4.5A0.5,0.5 0 0,0 12,5A0.5,0.5 0 0,0 12.5,4.5A0.5,0.5 0 0,0 12,4M6,9A2,2 0 0,1 8,11A2,2 0 0,1 6,13A2,2 0 0,1 4,11A2,2 0 0,1 6,9M18,9A2,2 0 0,1 20,11A2,2 0 0,1 18,13A2,2 0 0,1 16,11A2,2 0 0,1 18,9M7.5,16A0.5,0.5 0 0,1 8,16.5A0.5,0.5 0 0,1 7.5,17A0.5,0.5 0 0,1 7,16.5A0.5,0.5 0 0,1 7.5,16M16.5,16A0.5,0.5 0 0,1 17,16.5A0.5,0.5 0 0,1 16.5,17A0.5,0.5 0 0,1 16,16.5A0.5,0.5 0 0,1 16.5,16Z"/>
                                            </svg>
                                        </div>
                                        <h3 className="text-base font-semibold text-gray-900">AI Assistant</h3>
                                    </div>
                                </div>
                                {/* Chat messages */}
                                <div
                                    className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50"
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        const url = e.dataTransfer.getData("text/uri-list");
                                        const hit = displayFiles.find((f) => f.fileUrl === url);
                                        if (url && hit) attachFile(url, hit.fileName);
                                    }}
                                >
                                    {(() => {
                                        // Group consecutive AI messages with tool calls into single messages
                                        const groupedMessages: any[] = [];
                                        let currentGroup: any = null;
                                        
                                        chatMessages.forEach((m: any, idx: number) => {
                                            if (m.role === 'assistant' && currentGroup && currentGroup.role === 'assistant') {
                                                // Merge with previous AI message
                                                if (m.parts) {
                                                    currentGroup.parts = [...(currentGroup.parts || []), ...(m.parts || [])];
                                                }
                                                if (m.content && !currentGroup.parts) {
                                                    currentGroup.content = (currentGroup.content || '') + '\n\n' + m.content;
                                                }
                                                if (m.toolInvocations) {
                                                    currentGroup.toolInvocations = [...(currentGroup.toolInvocations || []), ...(m.toolInvocations || [])];
                                                }
                                                if (m.fileUrls) {
                                                    currentGroup.fileUrls = [...(currentGroup.fileUrls || []), ...(m.fileUrls || [])];
                                                }
                                            } else {
                                                // Start new group
                                                if (currentGroup) {
                                                    groupedMessages.push(currentGroup);
                                                }
                                                currentGroup = { ...m };
                                            }
                                        });
                                        
                                        if (currentGroup) {
                                            groupedMessages.push(currentGroup);
                                        }
                                        
                                        return groupedMessages;
                                    })().map((m: any, idx: number) => (
                                        <div key={m.id || idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                                            <div className={`flex gap-3 max-w-[85%] ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                                                {/* Avatar */}
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                                    m.role === "user" 
                                                        ? "bg-blue-100" 
                                                        : "bg-green-100"
                                                }`}>
                                                    {m.role === "user" ? (
                                                        <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                                        </svg>
                                                    ) : (
                                                        <span className="text-xs font-bold text-green-600">obo</span>
                                                    )}
                                                </div>
                                                
                                                {/* Message content */}
                                                <div className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                                                    {/* Name and timestamp */}
                                                    <div className={`flex items-center gap-2 mb-1 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                                                        <span className="text-sm font-medium text-gray-900">
                                                            {m.role === "user" ? "You" : "AI Assistant"}
                                                        </span>
                                                    </div>
                                                    
                                                    {/* Message bubble */}
                                                    <div className="rounded-lg px-4 py-3 max-w-full bg-white border border-gray-200 shadow-sm">
                                                        {/* Render each part according to its type */}
                                                        {m.parts?.map((part: any, idx: number) => {
                                                            if (part.type === 'text' && typeof part.text === 'string') {
                                                                return (
                                                                    <div key={idx} className="text-sm text-gray-900">
                                                                        <Markdown content={part.text} />
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        })}
                                                        {/* Fallback for legacy content */}
                                                        {!m.parts && typeof m.content === 'string' && (
                                                            <div className="text-sm text-gray-900">
                                                                <Markdown content={m.content} />
                                                            </div>
                                                        )}
                                                        
                                                        {/* File attachments as cards */}
                                                        {(() => {
                                                            const pills: string[] = Array.isArray(m.fileUrls) && m.fileUrls.length ? [...m.fileUrls] : [];
                                                            if (pills.length === 0 && Array.isArray(m.parts)) {
                                                                m.parts.forEach((p: any) => {
                                                                    if (p.type === 'text') {
                                                                        const text = typeof p.text === 'string' ? p.text : String(p.text ?? '');
                                                                        const matches = text.match(/@([^\s]+)/g);
                                                                        if (matches) {
                                                                            matches.forEach((tag: string) => {
                                                                                const name = tag.replace(/^@/, '');
                                                                                const hit = displayFiles.find(f => f.fileName === name);
                                                                                if (hit?.fileUrl) pills.push(hit.fileUrl);
                                                                            });
                                                                        }
                                                                    }
                                                                });
                                                            }
                                                            if (pills.length === 0) return null;
                                                            return (
                                                                <div className="mt-2 space-y-1">
                                                                    {pills.map((u: string) => {
                                                                        const f = displayFiles.find(f => f.fileUrl === u);
                                                                        const name = f?.fileName || 'file';
                                                                        return (
                                                                            <div key={u} className="flex items-center gap-2 px-3 py-2 rounded-md border bg-gray-50 border-gray-200">
                                                                                <FileText className="w-4 h-4 text-gray-500" />
                                                                                <span className="text-sm truncate text-gray-700">
                                                                                    {name}
                                                                                </span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            );
                                                        })()}
                                                        
                                                        {/* Tool invocation results as clickable links - grouped together */}
                                                        {m.toolInvocations && m.toolInvocations.length > 0 && (
                                                            <div className="mt-2 space-y-1">
                                                                {m.toolInvocations.map((ti: any) => (
                                                                    <ToolInvocationDisplay key={ti.toolCallId} invocation={ti} />
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Input */}
                                <form onSubmit={onChatSubmit} className="p-3 border-t bg-white flex flex-col gap-2 relative shadow-sm">
                            {/* attachment chips */}
                            {queuedFileUrls.length > 0 && (
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-gray-600 font-medium">
                                            {queuedFileUrls.length} file{queuedFileUrls.length > 1 ? 's' : ''} attached
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-xs h-5 px-2 text-gray-500 hover:text-gray-700"
                                            onClick={() => setQueuedFileUrls([])}
                                        >
                                            Clear all
                                        </Button>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {queuedFileUrls.map((u) => {
                                            const f = displayFiles.find(f => f.fileUrl === u);
                                            const name = f?.fileName || 'file';
                                            return (
                                                <span key={u} className="flex items-center gap-1 bg-blue-100 text-blue-800 rounded-md px-2 py-1 text-xs border border-blue-200">
                                                    <FileText className="w-3 h-3" />
                                                    <span className="max-w-24 truncate" title={name}>{name}</span>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setQueuedFileUrls(prev => prev.filter(x => x !== u))} 
                                                        className="ml-1 text-blue-600 hover:text-blue-800 hover:bg-blue-200 rounded-full w-4 h-4 flex items-center justify-center text-xs"
                                                        title="Remove file"
                                                    >
                                                        ×
                                                    </button>
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            {/* Quick Action Buttons */}
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    type="button"
                                    className="text-xs h-7"
                                    onClick={() => handleQuickAction('Extract for shipment')}
                                    disabled={isLoading}
                                >
                                    Extract for Shipment
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    type="button"
                                    className="text-xs h-7"
                                    onClick={() => handleQuickAction('Extract for N10')}
                                    disabled={isLoading}
                                >
                                    Extract for N10
                                </Button>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm"
                                    placeholder="Type a message..."
                                    value={chatInput}
                                    onChange={onInputChange}
                                    onKeyDown={onInputKeyDown}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        const url = e.dataTransfer.getData("text/uri-list");
                                        const hit = displayFiles.find((f) => f.fileUrl === url);
                                        if (url && hit) attachFile(url, hit.fileName);
                                    }}
                                    ref={inputRef}
                                />
                                <Button type="submit" size="sm" disabled={isLoading || !chatInput.trim()} className="shadow-sm">
                                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send"}
                                    </Button>
                                </div>

                            {/* mention dropdown */}
                            {mentionActive && mentionSuggestions.length > 0 && (
                                <div className="absolute left-3 bottom-full mb-1 bg-white border border-gray-200 rounded-md shadow-lg w-56 max-h-60 overflow-y-auto z-20 text-sm">
                                    {mentionSuggestions.map((file, idx) => (
                                        <div key={file._id}
                                            className={`px-3 py-2 cursor-pointer transition-colors ${idx === mentionIndex ? 'bg-blue-600 text-white' : 'hover:bg-gray-50'}`}
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                if (file.isAll) {
                                                    attachAllFiles();
                                                } else {
                                                    attachFile(file.fileUrl || '', file.fileName);
                                                }
                                            }}
                                        >{file.fileName}</div>
                                    ))}
                        </div>
                    )}
                                </form>
                            </div>
                        </ResizablePanel>
                    </ResizablePanelGroup>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
}
