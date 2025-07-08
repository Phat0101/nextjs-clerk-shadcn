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
import { Loader2 } from "lucide-react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useChat } from "@ai-sdk/react";
import Markdown from "@/components/Markdown";
import DocumentView from "../../documentView";
import { Label } from "@/components/ui/label";
import { Loader2 as NewLoader2 } from "lucide-react";
import { useState as useLocalState, useEffect as useLocalEffect } from 'react';
import FilesAndDocumentPanel, { JobFile } from "../../FilesAndDocumentPanel";
import ChatPanel from "../../ChatPanel";

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
        isLoading,
        append,
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

    // Extraction results
    const [shipmentData, setShipmentData] = useState<any | null>(null);
    const [n10Data, setN10Data] = useState<any | null>(null);
    const [isExtracting, setIsExtracting] = useState(false);
    const [activeDataType, setActiveDataType] = useState<'shipment' | 'n10'>('shipment');
    const [extractionType, setExtractionType] = useState<'shipment' | 'n10' | null>(null);

    // Mention/autocomplete state
    const [mentionActive, setMentionActive] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionIndex, setMentionIndex] = useState(0);

    // Capture streamed "thinking" parts from messages
    const thinkingLines = useMemo(() => {
        const lines: string[] = [];
        chatMessages.forEach((m: any) => {
            if (Array.isArray(m.parts)) {
                m.parts.forEach((p: any) => {
                    if (p.type === 'thinking' && typeof p.text === 'string') {
                        lines.push(p.text);
                    }
                });
            }
        });
        return lines;
    }, [chatMessages]);

    // Sync data from persisted job record
    useEffect(() => {
        if (jobDetails?.job?.shipmentRegistrationExtractedData) {
            setShipmentData(jobDetails.job.shipmentRegistrationExtractedData);
        }
        if (jobDetails?.job?.n10extractedData) {
            setN10Data(jobDetails.job.n10extractedData);
        }
    }, [jobDetails]);

    // Auto-switch to the data type that has data (when only one type exists)
    useEffect(() => {
        if (shipmentData && !n10Data) {
            setActiveDataType('shipment');
        } else if (!shipmentData && n10Data) {
            setActiveDataType('n10');
        }
    }, [shipmentData, n10Data]);

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
                                            className="w-full h-8 bg-white px-2 focus:outline-none focus:ring-0 text-left"
                                            value={temp}
                                            onChange={(e) => setTemp(e.target.value)}
                                            onBlur={() => finishEdit(k)}
                                            autoFocus
                                        />
                                    ) : (
                                        <span
                                            className="flex items-center w-full h-8 px-2 cursor-text text-left truncate whitespace-nowrap overflow-hidden"
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

    // Side-by-side editor for consignor vs consignee
    const ConsignorConsigneeEditor = () => {
        const fieldKeys = ['company', 'address', 'city_state', 'country'];
        const [conLocal, setConLocal] = useLocalState<any>(shipmentData?.consignor || {});
        const [ceeLocal, setCeeLocal] = useLocalState<any>(shipmentData?.consignee || {});
        const [editing, setEditing] = useLocalState<{ party: 'consignor' | 'consignee'; key: string } | null>(null);
        const [temp, setTemp] = useLocalState('');

        // Sync when outer data changes
        useLocalEffect(() => {
            setConLocal(shipmentData?.consignor || {});
            setCeeLocal(shipmentData?.consignee || {});
        }, [shipmentData]);

        const startEdit = (party: 'consignor' | 'consignee', key: string) => {
            setEditing({ party, key });
            const currentVal = party === 'consignor' ? conLocal[key] : ceeLocal[key];
            setTemp(String(currentVal ?? ''));
        };

        const finishEdit = async () => {
            if (!editing) return;
            const { party, key } = editing;
            const newVal = temp.trim() === '' ? null : temp;
            const updatedCon = { ...conLocal };
            const updatedCee = { ...ceeLocal };
            if (party === 'consignor') {
                updatedCon[key] = newVal;
            } else {
                updatedCee[key] = newVal;
            }
            setConLocal(updatedCon);
            setCeeLocal(updatedCee);

            const merged = { ...shipmentData, consignor: updatedCon, consignee: updatedCee };
            setShipmentData(merged);

            try {
                await updateStep({ jobId, step: 'extracting', shipmentRegistrationExtractedData: merged });
            } catch (err) {
                console.error('save consignor/consignee edit failed', err);
            }
            setEditing(null);
        };

        const fmt = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));

        return (
            <div className="mb-4">
                <h4 className="font-medium mb-1">Parties</h4>
                <table className="min-w-full table-fixed border border-gray-200 text-xs">
                    <colgroup>
                        <col style={{ width: '20%' }} />
                        <col style={{ width: '40%' }} />
                        <col style={{ width: '40%' }} />
                    </colgroup>
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-2 py-1 border-r text-left">Field</th>
                            <th className="px-2 py-1 border-r text-left">Consignor</th>
                            <th className="px-2 py-1 text-left">Consignee</th>
                        </tr>
                    </thead>
                    <tbody>
                        {fieldKeys.map((k) => (
                            <tr key={k} className="border-t last:border-b-0">
                                <td className="px-2 py-1 border-r whitespace-nowrap align-middle truncate">{k}</td>
                                {/* Consignor cell */}
                                <td className="px-0 h-8 border-r align-middle text-left">
                                    {editing && editing.party === 'consignor' && editing.key === k ? (
                                        <input
                                            className="w-full h-8 bg-white px-2 focus:outline-none focus:ring-0 text-left"
                                            value={temp}
                                            onChange={(e) => setTemp(e.target.value)}
                                            onBlur={finishEdit}
                                            autoFocus
                                        />
                                    ) : (
                                        <span
                                            className="flex items-center w-full h-8 px-2 cursor-text truncate"
                                            onClick={() => startEdit('consignor', k)}
                                            title={fmt(conLocal[k])}
                                        >
                                            {fmt(conLocal[k])}
                                        </span>
                                    )}
                                </td>
                                {/* Consignee cell */}
                                <td className="px-0 h-8 align-middle text-left">
                                    {editing && editing.party === 'consignee' && editing.key === k ? (
                                        <input
                                            className="w-full h-8 bg-white px-2 focus:outline-none focus:ring-0 text-left"
                                            value={temp}
                                            onChange={(e) => setTemp(e.target.value)}
                                            onBlur={finishEdit}
                                            autoFocus
                                        />
                                    ) : (
                                        <span
                                            className="flex items-center w-full h-8 px-2 cursor-text truncate"
                                            onClick={() => startEdit('consignee', k)}
                                            title={fmt(ceeLocal[k])}
                                        >
                                            {fmt(ceeLocal[k])}
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

        const startEdit = (k: string) => {
            setEditing(k);
            setTemp(String(getNested(localData, k) ?? ''));
        };

        const finishEdit = async (k: string) => {
            const newVal = temp.trim() === '' ? null : temp;
            const updated = setNested({ ...localData }, k, newVal);
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
                                                className="w-full h-8 bg-white px-2 focus:outline-none focus:ring-0 text-left"
                                                value={temp}
                                                onChange={(e) => setTemp(e.target.value)}
                                                onBlur={() => finishEdit(k)}
                                                autoFocus
                                            />
                                        ) : (
                                            <span
                                                className="flex items-center w-full h-8 px-2 cursor-text text-left truncate whitespace-nowrap overflow-hidden"
                                                onClick={() => startEdit(k)}
                                                title={fmt(getNested(localData, k))}
                                            >
                                                {fmt(getNested(localData, k))}
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
        { title: 'Consignor', keys: ['company', 'address', 'city_state', 'country'] },
        { title: 'Consignee', keys: ['company', 'address', 'city_state', 'country'] },
        { title: 'Mode', keys: ['transport', 'container', 'type'] },
        { title: 'Customs', keys: ['aqis_status', 'customs_status', 'subject_to_aqis', 'subject_to_jfis'] },
        { title: 'Details', keys: ['house_bill', 'domestic', 'origin', 'destination', 'etd', 'eta', 'weight_value', 'weight_unit', 'volume_value', 'volume_unit', 'chargeable_value', 'chargeable_unit', 'packages_count', 'packages_type', 'wv_ratio', 'inners_count', 'inners_type', 'goods_value_amount', 'goods_value_currency', 'insurance_value_amount', 'insurance_value_currency', 'description', 'marks_numbers', 'incoterm', 'free_on_board', 'spot_rate', 'spot_rate_type', 'use_standard_rate', 'service_level', 'release_type', 'charges_apply', 'phase', 'order_refs'] },
    ];

    const n10PlaceholderSections = [
        { title: 'Declaration Header', keys: ['ownerReference', 'valuationDate', 'eftPaymentIndicator'] },
        { title: 'Owner Details', keys: ['abn', 'name', 'address.street', 'contact.email'] },
        { title: 'Sender Details', keys: ['name', 'address.street', 'supplierId.ccid'] },
        { title: 'Transport Information', keys: ['modeOfTransport', 'firstArrivalDate', 'grossWeight', 'numberOfPackages'] },
        { title: 'Goods Declaration', keys: ['lineNumber', 'goodsDescription', 'tariffClassificationNumber', 'quantity', 'price'] },
        { title: 'Declaration Statement', keys: ['name', 'date', 'isOwner'] },
    ];

    const n10FieldKeys = {
        declarationHeader: ['ownerReference', 'biosecurityInspectionLocation', 'valuationDate', 'headerValuationAdviceNumber', 'eftPaymentIndicator'],
        ownerDetails: ['abn', 'cac', 'ccid', 'name', 'address.street', 'address.city', 'address.state', 'address.postcode', 'contact.phone', 'contact.mobile', 'contact.fax', 'contact.email'],
        senderDetails: ['name', 'address.street', 'address.city', 'address.state', 'address.postcode', 'supplierId.ccid', 'supplierId.abn', 'vendorId.abn', 'vendorId.arn'],
        transportInformation: ['modeOfTransport', 'firstArrivalDate', 'grossWeight', 'grossWeightUnit', 'numberOfPackages', 'marksAndNumbersDescription', 'loadingPort', 'dischargePort', 'sea.vesselName', 'sea.vesselId', 'sea.voyageNumber', 'sea.firstArrivalPort', 'sea.cargoType', 'sea.containerNumber', 'sea.oceanBillOfLadingNumber', 'sea.houseBillOfLadingNumber', 'air.masterAirWaybillNumber', 'air.houseAirWaybillNumber', 'post.parcelPostCardNumber', 'other.departmentReceiptForGoodsNumber'],
        declarationStatement: ['declarationStatement.name', 'declarationStatement.signature', 'declarationStatement.date', 'declarationStatement.isOwner', 'declarationStatement.isAgent', 'amberStatement.reasonForUncertainty'],
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="bg-white border-b p-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                    <h1 className="text-xl font-bold">{job.title}</h1>
                    <TimeRemaining deadline={job.deadline} />
                </div>
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
                    >
                        Export CSV ({activeDataType === 'shipment' ? 'Shipment' : 'N10'})
                    </Button>
                )}
            </div>

            <ResizablePanelGroup direction="horizontal" className="flex-1">
                {/* Left – files & document preview */}
                <ResizablePanel defaultSize={25} minSize={15}>
                    <FilesAndDocumentPanel
                        displayFiles={displayFiles}
                        previewIndex={previewIndex}
                        onPreviewChange={setPreviewIndex}
                    />
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* Middle – output panel */}
                <ResizablePanel defaultSize={50} minSize={35}>
                    <div className="flex flex-col h-full">
                        {/* Data type switcher header - only show if both data types exist */}
                        {shipmentData && n10Data && (
                            <div className="p-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-600">Document Type:</span>
                                    <div className="flex bg-gray-100 rounded-lg p-1">
                                        <button
                                            onClick={() => setActiveDataType('shipment')}
                                            className={`px-3 py-1 text-xs rounded-md transition-colors ${activeDataType === 'shipment'
                                                ? 'bg-white text-blue-600 shadow-sm'
                                                : 'text-gray-600 hover:text-gray-800'
                                                }`}
                                        >
                                            Shipment Registration
                                        </button>
                                        <button
                                            onClick={() => setActiveDataType('n10')}
                                            className={`px-3 py-1 text-xs rounded-md transition-colors ${activeDataType === 'n10'
                                                ? 'bg-white text-blue-600 shadow-sm'
                                                : 'text-gray-600 hover:text-gray-800'
                                                }`}
                                        >
                                            N10 Document
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Content area */}
                        <div className="flex-1 overflow-y-auto">
                            {(() => {
                                // Determine what to show based on available data and active type
                                const hasShipmentData = !!shipmentData;
                                const hasN10Data = !!n10Data;

                                // If both exist, show based on active type
                                if (hasShipmentData && hasN10Data) {
                                    if (activeDataType === 'shipment') {
                                        return (
                                            <div className="p-4 space-y-4 text-sm">
                                                <ConsignorConsigneeEditor />
                                                <div className="flex gap-4">
                                                    <div className="flex-1">
                                                        <SectionEditor title="Mode" sectionKey="mode" keys={['transport', 'container', 'type']} />
                                                    </div>
                                                    <div className="flex-1">
                                                        <SectionEditor title="Customs" sectionKey="customs_fields" keys={['aqis_status', 'customs_status', 'subject_to_aqis', 'subject_to_jfis']} />
                                                    </div>
                                                </div>
                                                <SectionEditor title="Details" sectionKey="details" keys={['house_bill', 'domestic', 'origin', 'destination', 'etd', 'eta', 'weight_value', 'weight_unit', 'volume_value', 'volume_unit', 'chargeable_value', 'chargeable_unit', 'packages_count', 'packages_type', 'wv_ratio', 'inners_count', 'inners_type', 'goods_value_amount', 'goods_value_currency', 'insurance_value_amount', 'insurance_value_currency', 'description', 'marks_numbers', 'incoterm', 'free_on_board', 'spot_rate', 'spot_rate_type', 'use_standard_rate', 'service_level', 'release_type', 'charges_apply', 'phase', 'order_refs']} />
                                            </div>
                                        );
                                    } else {
                                        const handleUpdate = async (sectionKey: string, updatedSectionData: any) => {
                                            const updatedN10Data = { ...n10Data, [sectionKey]: updatedSectionData };
                                            setN10Data(updatedN10Data);
                                            try {
                                                await updateStep({ jobId, step: 'extracting', n10extractedData: updatedN10Data });
                                            } catch (err) {
                                                console.error('save N10 edit failed', err);
                                            }
                                        };
                                        return (
                                            <div className="p-4 space-y-4 text-sm">
                                                <N10ObjectEditor title="Declaration Header" data={n10Data?.declarationHeader} keys={n10FieldKeys.declarationHeader} onUpdate={(d) => handleUpdate('declarationHeader', d)} />
                                                <N10ObjectEditor title="Owner Details" data={n10Data?.ownerDetails} keys={n10FieldKeys.ownerDetails} onUpdate={(d) => handleUpdate('ownerDetails', d)} />
                                                <N10ObjectEditor title="Sender Details" data={n10Data?.senderDetails} keys={n10FieldKeys.senderDetails} onUpdate={(d) => handleUpdate('senderDetails', d)} />
                                                <N10ObjectEditor title="Transport Information" data={n10Data?.transportInformation} keys={n10FieldKeys.transportInformation} onUpdate={(d) => handleUpdate('transportInformation', d)} />
                                                <N10GoodsDeclarationViewer items={n10Data?.goodsDeclaration} />
                                                <N10ObjectEditor title="Declaration Statement" data={n10Data} keys={n10FieldKeys.declarationStatement} onUpdate={(d) => setN10Data({ ...n10Data, ...d })} />
                                            </div>
                                        );
                                    }
                                }

                                // If only shipment data exists
                                if (hasShipmentData && !hasN10Data) {
                                    return (
                                        <div className="p-4 space-y-4 text-sm">
                                            <ConsignorConsigneeEditor />
                                            <div className="flex gap-4">
                                                <div className="flex-1">
                                                    <SectionEditor title="Mode" sectionKey="mode" keys={['transport', 'container', 'type']} />
                                                </div>
                                                <div className="flex-1">
                                                    <SectionEditor title="Customs" sectionKey="customs_fields" keys={['aqis_status', 'customs_status', 'subject_to_aqis', 'subject_to_jfis']} />
                                                </div>
                                            </div>
                                            <SectionEditor title="Details" sectionKey="details" keys={['house_bill', 'domestic', 'origin', 'destination', 'etd', 'eta', 'weight_value', 'weight_unit', 'volume_value', 'volume_unit', 'chargeable_value', 'chargeable_unit', 'packages_count', 'packages_type', 'wv_ratio', 'inners_count', 'inners_type', 'goods_value_amount', 'goods_value_currency', 'insurance_value_amount', 'insurance_value_currency', 'description', 'marks_numbers', 'incoterm', 'free_on_board', 'spot_rate', 'spot_rate_type', 'use_standard_rate', 'service_level', 'release_type', 'charges_apply', 'phase', 'order_refs']} />
                                        </div>
                                    );
                                }

                                // If only N10 data exists
                                if (!hasShipmentData && hasN10Data) {
                                    const handleUpdate = async (sectionKey: string, updatedSectionData: any) => {
                                        const updatedN10Data = { ...n10Data, [sectionKey]: updatedSectionData };
                                        setN10Data(updatedN10Data);
                                        try {
                                            await updateStep({ jobId, step: 'extracting', n10extractedData: updatedN10Data });
                                        } catch (err) {
                                            console.error('save N10 edit failed', err);
                                        }
                                    };
                                    return (
                                        <div className="p-4 space-y-4 text-sm">
                                            <N10ObjectEditor title="Declaration Header" data={n10Data?.declarationHeader} keys={n10FieldKeys.declarationHeader} onUpdate={(d) => handleUpdate('declarationHeader', d)} />
                                            <N10ObjectEditor title="Owner Details" data={n10Data?.ownerDetails} keys={n10FieldKeys.ownerDetails} onUpdate={(d) => handleUpdate('ownerDetails', d)} />
                                            <N10ObjectEditor title="Sender Details" data={n10Data?.senderDetails} keys={n10FieldKeys.senderDetails} onUpdate={(d) => handleUpdate('senderDetails', d)} />
                                            <N10ObjectEditor title="Transport Information" data={n10Data?.transportInformation} keys={n10FieldKeys.transportInformation} onUpdate={(d) => handleUpdate('transportInformation', d)} />
                                            <N10GoodsDeclarationViewer items={n10Data?.goodsDeclaration} />
                                            <N10ObjectEditor title="Declaration Statement" data={n10Data} keys={n10FieldKeys.declarationStatement} onUpdate={(d) => setN10Data({ ...n10Data, ...d })} />
                                        </div>
                                    );
                                }

                                // If extracting
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

                                // Default: no data
                                return (
                                    <div className="h-full flex items-center justify-center text-muted-foreground">
                                        Result will appear here...
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* Right – chat */}
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
                        onInputChange={onInputChange}
                        onInputKeyDown={onInputKeyDown}
                        onQuickAction={handleQuickAction}
                        onFileAttach={attachFile}
                        onRemoveQueuedFile={(url) => setQueuedFileUrls(prev => prev.filter(x => x !== url))}
                        mentionActive={mentionActive}
                        mentionSuggestions={mentionSuggestions}
                        mentionIndex={mentionIndex}
                        onMentionSelect={(file) => {
                            if (file.isAll) {
                                attachAllFiles();
                            } else {
                                attachFile(file.fileUrl || '', file.fileName);
                            }
                        }}
                        onMentionClose={() => setMentionActive(false)}
                    />
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
} 