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
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import TimeRemaining from "@/components/TimeRemaining";
import { CheckCircle, AlertCircle, Loader2, FileText, Info, LayoutPanelLeft, LayoutPanelTop, X } from "lucide-react";
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
        return (
            <div className="text-xs">
                <button onClick={() => setOpen(!open)} className="text-blue-600 hover:underline focus:outline-none">
                    {open ? 'Hide' : 'View'} {invocation.toolName} result
                </button>
                {open && (
                    <pre className="bg-gray-50 p-2 mt-1 rounded text-[10px] overflow-x-auto border">
                        {JSON.stringify(invocation.result, null, 2)}
                    </pre>
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

    // Chat persistence
    const persistedMessages = useQuery(convexApi.chat.getForJob, { jobId });
    const initialChatMessages = persistedMessages ?? undefined;

    // AI chat hook
    const {
        messages: chatMessages,
        input: chatInput,
        handleInputChange,
        handleSubmit,
    } = useChat({
        api: "/api/job-chat",
        initialMessages: initialChatMessages,
        sendExtraMessageFields: true, // Send id and createdAt for each message
    });

    // Helper to programmatically set chat input (for attachment tokens)
    const setChatInput = (val: string) => handleInputChange({ target: { value: val } } as any);

    // Files queued for the next request
    const [queuedFileUrls, setQueuedFileUrls] = useState<string[]>([]);

    // Preview index for DocumentView
    const [previewIndex, setPreviewIndex] = useState(0);
    type PreviewPosition = 'right' | 'bottom' | 'hidden';
    const [previewPosition, setPreviewPosition] = useState<PreviewPosition>('right');

    // Shipment extraction result (from extract_shipment tool)
    const [shipmentData, setShipmentData] = useState<any | null>(null);
    const [isExtracting, setIsExtracting] = useState(false);

    // Mention/autocomplete state
    const [mentionActive, setMentionActive] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionIndex, setMentionIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement | null>(null);

    // Sync shipment data from persisted job record
    useEffect(() => {
        if (jobDetails?.job?.extractedData) {
            setShipmentData(jobDetails.job.extractedData);
        }
    }, [jobDetails]);

    // Determine extracting state based on compilerStep and presence of extractedData in DB
    useEffect(() => {
        if (!jobDetails) return;

        const { job } = jobDetails;

        // If compiler is currently in the "extracting" step and we don't yet have extracted data → show placeholder
        if (job.compilerStep === 'extracting' && !job.extractedData) {
            setIsExtracting(true);
        } else {
            setIsExtracting(false);
        }
    }, [jobDetails]);

    // Handle chat submit to include queued file URLs
    const onChatSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        handleSubmit(e, { body: { jobId, fileUrls: queuedFileUrls } });
        // keep attachments so they show in chat; will clear when user manually removes
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

    // Display files (classified or originals)
    const displayFiles: JobFile[] = useMemo(() => {
        if (!jobDetails) return [];
        return (jobDetails.files as JobFile[]);
    }, [jobDetails]);

    // Ensure preview index resets if files list changes
    useEffect(() => {
        if (previewIndex >= displayFiles.length) {
            setPreviewIndex(0);
        }
    }, [displayFiles]);

    // suggestions computed
    const mentionSuggestions = useMemo(() => {
        if (!mentionActive) return [] as JobFile[];
        const q = mentionQuery.toLowerCase();
        return displayFiles.filter(f => f.fileName.toLowerCase().includes(q));
    }, [mentionActive, mentionQuery, displayFiles]);

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
                const file = mentionSuggestions[mentionIndex];
                if (file) attachFile(file.fileUrl || '', file.fileName);
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
                await updateStep({ jobId, step: 'extracting', extractedData: merged });
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

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="bg-white border-b p-2 flex items-center justify-between">
                <h1 className="text-xl font-bold">{job.title}</h1>
                    <TimeRemaining deadline={job.deadline} />
                            </div>

            <ResizablePanelGroup direction="horizontal" className="flex-1">
                {/* Left – files & chat */}
                <ResizablePanel defaultSize={25} minSize={15}>
                    <div className="flex flex-col h-full">
                        {/* File list header with layout buttons */}
                        <div className="border-b p-3 space-y-2 overflow-y-auto max-h-40 text-sm">
                            <div className="flex justify-between items-center">
                                <p className="font-medium">Job Files (drag into chat)</p>
                                <div className="flex gap-1">
                                    <button title="Preview bottom" onClick={() => setPreviewPosition('bottom')} className={`p-1 rounded ${previewPosition === 'bottom' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}><LayoutPanelTop className="w-4 h-4" /></button>
                                    <button title="Preview right" onClick={() => setPreviewPosition('right')} className={`p-1 rounded ${previewPosition === 'right' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}><LayoutPanelLeft className="w-4 h-4" /></button>
                                    <button title="Hide preview" onClick={() => setPreviewPosition('hidden')} className={`p-1 rounded ${previewPosition === 'hidden' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}><X className="w-4 h-4" /></button>
                            </div>
                        </div>
                            {displayFiles.map((file, idx) => (
                                <div
                                    key={file._id}
                                    draggable
                                    onDragStart={(e) => e.dataTransfer.setData("text/uri-list", file.fileUrl || "")}
                                    className={`truncate cursor-grab px-1 py-0.5 rounded ${idx === previewIndex ? 'bg-blue-100 text-blue-800' : 'text-blue-700 hover:underline'}`}
                                    onClick={() => setPreviewIndex(idx)}
                                    onDoubleClick={() => attachFile(file.fileUrl || "", file.fileName)}
                                >
                                    {file.fileName}
                            </div>
                        ))}
                                </div>

                        {/* Chat messages */}
                        <div
                            className="flex-1 overflow-y-auto p-4 space-y-3"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                                e.preventDefault();
                                const url = e.dataTransfer.getData("text/uri-list");
                                const hit = displayFiles.find((f) => f.fileUrl === url);
                                if (url && hit) attachFile(url, hit.fileName);
                            }}
                        >
                            {chatMessages.map((m: any, idx: number) => (
                                <div key={m.id || idx} className="space-y-1 text-sm">
                                    <div className="font-semibold text-gray-500">
                                        {m.role === "user" ? "You" : "AI"}
                            </div>
                                    {/* Render each part according to its type */}
                                    {m.parts?.map((part: any, idx: number) => {
                                        if (part.type === 'text' && typeof part.text === 'string') {
                                            return <Markdown key={idx} content={part.text} />;
                                        }
                                        return null; // suppress raw tool-invocation parts
                                    })}
                                    {/* Fallback for legacy content */}
                                    {!m.parts && typeof m.content === 'string' && <Markdown content={m.content} />}
                                    {/* Attachment pills derived from explicit property OR mentions */}
                                    {(() => {
                                        const pills: string[] = Array.isArray(m.fileUrls) && m.fileUrls.length ? [...m.fileUrls] : [];
                                        if (pills.length === 0 && Array.isArray(m.parts)) {
                                            // if message text contains @filename mentions
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
                                            <div className="flex flex-wrap">
                                                {pills.map((u: string) => {
                                                    const f = displayFiles.find(f => f.fileUrl === u);
                                                    const name = f?.fileName || 'file';
                                                    return <FilePill key={u} name={name} />;
                                                })}
                                                                </div>
                                        );
                                    })()}
                                    {/* Display tool invocation result if available */}
                                    {m.toolInvocations?.map((ti: any) => (
                                        <ToolInvocationDisplay key={ti.toolCallId} invocation={ti} />
                                ))}
                                                                </div>
                            ))}
                                                                </div>

                        {/* Input */}
                        <form onSubmit={onChatSubmit} className="p-3 border-t flex flex-col gap-2 relative">
                            {/* attachment chips */}
                            {queuedFileUrls.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-1">
                                    {queuedFileUrls.map((u) => {
                                        const f = displayFiles.find(f => f.fileUrl === u);
                                        const name = f?.fileName || 'file';
                                        return (
                                            <span key={u} className="flex items-center gap-1 bg-gray-200 text-gray-800 rounded-full px-2 py-0.5 text-xs">
                                                <FileText className="w-3 h-3" />
                                                {name}
                                                <button type="button" onClick={() => setQueuedFileUrls(prev => prev.filter(x => x !== u))} className="ml-1 text-gray-500 hover:text-gray-700">×</button>
                                </span>
                                                    );
                                                })}
                                    </div>
                            )}
                            <div className="flex items-center gap-2">
                            <input
                                className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                            <Button type="submit" size="sm">
                                    Send
                                </Button>
                            </div>

                            {/* mention dropdown */}
                            {mentionActive && mentionSuggestions.length > 0 && (
                                <div className="absolute left-3 bottom-full mb-1 bg-white border rounded shadow-lg w-56 max-h-60 overflow-y-auto z-20 text-sm">
                                    {mentionSuggestions.map((file, idx) => (
                                        <div key={file._id}
                                            className={`px-2 py-1 cursor-pointer ${idx === mentionIndex ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'}`}
                                            onMouseDown={(e) => { e.preventDefault(); attachFile(file.fileUrl || '', file.fileName); }}
                                        >{file.fileName}</div>
                                    ))}
                                            </div>
                            )}
                        </form>
                            </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* Middle – output panel */}
                <ResizablePanel defaultSize={previewPosition === 'right' ? 45 : (previewPosition === 'hidden' ? 70 : 60)} minSize={25}>
                    {(() => {
                        const contentNode = shipmentData ? (
                            <>
                                <SectionEditor title="Mode" sectionKey="mode" keys={['transport', 'container', 'type']} />
                                <SectionEditor title="Consignor" sectionKey="consignor" keys={['company', 'address', 'city_state', 'country']} />
                                <SectionEditor title="Consignee" sectionKey="consignee" keys={['company', 'address', 'city_state', 'country']} />
                                <SectionEditor title="Details" sectionKey="details" keys={['house_bill', 'domestic', 'origin', 'destination', 'etd', 'eta', 'weight_value', 'weight_unit', 'volume_value', 'volume_unit', 'chargeable_value', 'chargeable_unit', 'packages_count', 'packages_type', 'wv_ratio', 'inners_count', 'inners_type', 'goods_value_amount', 'goods_value_currency', 'insurance_value_amount', 'insurance_value_currency', 'description', 'marks_numbers', 'incoterm', 'free_on_board', 'spot_rate', 'spot_rate_type', 'use_standard_rate', 'service_level', 'release_type', 'charges_apply', 'phase', 'order_refs']} />
                                <SectionEditor title="Customs" sectionKey="customs_fields" keys={['aqis_status', 'customs_status', 'subject_to_aqis', 'subject_to_jfis']} />
                            </>
                        ) : isExtracting ? (
                            <>
                                <div className="flex items-center gap-2 mb-2">
                                    <h3 className="font-semibold">Preparing extraction fields</h3>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                            </div>
                                {[
                                    { title: 'Mode', keys: ['transport', 'container', 'type'] },
                                    { title: 'Consignor', keys: ['company', 'address', 'city_state', 'country'] },
                                    { title: 'Consignee', keys: ['company', 'address', 'city_state', 'country'] },
                                    { title: 'Details', keys: ['house_bill', 'domestic', 'origin', 'destination', 'etd', 'eta', 'weight_value', 'weight_unit', 'volume_value', 'volume_unit', 'chargeable_value', 'chargeable_unit', 'packages_count', 'packages_type', 'wv_ratio', 'inners_count', 'inners_type', 'goods_value_amount', 'goods_value_currency', 'insurance_value_amount', 'insurance_value_currency', 'description', 'marks_numbers', 'incoterm', 'free_on_board', 'spot_rate', 'spot_rate_type', 'use_standard_rate', 'service_level', 'release_type', 'charges_apply', 'phase', 'order_refs'] },
                                    { title: 'Customs', keys: ['aqis_status', 'customs_status', 'subject_to_aqis', 'subject_to_jfis'] },
                                ].map(section => (
                                    <SectionPlaceholder key={section.title} title={section.title} keys={section.keys} />
                                ))}
                                        </>
                                    ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground">
                                Awaiting action...
                            </div>
                        );

                        if (previewPosition === 'bottom') {
                                            return (
                                <ResizablePanelGroup direction="vertical" className="h-full text-sm">
                                    <ResizablePanel defaultSize={67} minSize={40}>
                                        <div className="p-4 h-full overflow-y-auto space-y-4">
                                            {contentNode}
                                </div>
                                    </ResizablePanel>
                                    <ResizableHandle withHandle />
                                    <ResizablePanel defaultSize={33} minSize={20}>
                                        {displayFiles.length > 0 ? (
                                            <DocumentView files={displayFiles} previewIndex={previewIndex} onPreviewChange={setPreviewIndex} />
                                        ) : (
                                            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No files</div>
                                        )}
                                    </ResizablePanel>
                                </ResizablePanelGroup>
                            );
                        }

                        // preview not bottom
                                            return (
                            <div className="p-4 h-full overflow-y-auto space-y-4 text-sm">
                                {contentNode}
                                                </div>
                                            );
                    })()}
                </ResizablePanel>

                {previewPosition === 'right' && (
                    <>
                <ResizableHandle withHandle />
                        <ResizablePanel defaultSize={25} minSize={20}>
                            {displayFiles.length > 0 ? (
                                <DocumentView files={displayFiles} previewIndex={previewIndex} onPreviewChange={setPreviewIndex} />
                            ) : (
                                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No files</div>
                    )}
                </ResizablePanel>
                    </>
                )}
            </ResizablePanelGroup>
        </div>
    );
} 