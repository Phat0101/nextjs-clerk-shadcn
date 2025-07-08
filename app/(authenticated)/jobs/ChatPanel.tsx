/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Loader2, FileText } from "lucide-react";
import Markdown from "@/components/Markdown";
import { JobFile } from "./FilesAndDocumentPanel";

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

interface ChatPanelProps {
    chatMessages: any[];
    chatInput: string;
    isLoading: boolean;
    queuedFileUrls: string[];
    displayFiles: JobFile[];
    previewIndex: number;
    onPreviewChange: (index: number) => void;
    thinkingLines: string[];
    onChatSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
    onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    onQuickAction: (prompt: string) => void;
    onFileAttach: (url: string, fileName: string) => void;
    onRemoveQueuedFile: (url: string) => void;
    mentionActive: boolean;
    mentionSuggestions: (JobFile & { isAll?: boolean })[];
    mentionIndex: number;
    onMentionSelect: (suggestion: JobFile & { isAll?: boolean }) => void;
    onMentionClose: () => void;
}

export default function ChatPanel({
    chatMessages,
    chatInput,
    isLoading,
    queuedFileUrls,
    displayFiles,
    previewIndex,
    onPreviewChange,
    thinkingLines,
    onChatSubmit,
    onInputChange,
    onInputKeyDown,
    onQuickAction,
    onFileAttach,
    onRemoveQueuedFile,
    mentionActive,
    mentionSuggestions,
    mentionIndex,
    onMentionSelect,
    onMentionClose,
}: ChatPanelProps) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const thinkingRef = useRef<HTMLDivElement | null>(null);

    // Auto-scroll thinking box
    useEffect(() => {
        if (thinkingRef.current) {
            thinkingRef.current.scrollTop = thinkingRef.current.scrollHeight;
        }
    }, [thinkingLines]);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const url = e.dataTransfer.getData("text/uri-list");
        const hit = displayFiles.find((f) => f.fileUrl === url);
        if (url && hit) onFileAttach(url, hit.fileName);
    };

    return (
        <ResizablePanelGroup direction="vertical" className="h-full">
            {/* File list at top */}
            <ResizablePanel defaultSize={20} minSize={10}>
                <div className="p-3 space-y-2 overflow-y-auto max-h-48 text-sm">
                    <div className="flex justify-between items-center">
                        <p className="font-medium">Job Files</p>
                    </div>
                    {displayFiles.map((file, idx) => (
                        <div
                            key={file._id}
                            draggable
                            onDragStart={(e) => e.dataTransfer.setData("text/uri-list", file.fileUrl || "")}
                            className={`truncate cursor-grab px-1 py-0.5 rounded ${idx === previewIndex ? 'bg-blue-100 text-blue-800' : 'text-blue-700 hover:underline'}`}
                            onClick={() => onPreviewChange(idx)}
                            onDoubleClick={() => onFileAttach(file.fileUrl || '', file.fileName)}
                        >
                            {file.fileName}
                        </div>
                    ))}
                </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Chat area */}
            <ResizablePanel defaultSize={80} minSize={50}>
                <div className="flex flex-col h-full">
                    {/* Chat messages */}
                    <div
                        className="flex-1 overflow-y-auto p-4 space-y-3"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDrop}
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

                    {/* Streaming thinking box */}
                    {thinkingLines.length > 0 && (
                        <div
                            ref={thinkingRef}
                            className="h-24 overflow-y-auto bg-gray-50 border-t border-gray-200 px-2 py-1 text-[10px] font-mono"
                        >
                            {thinkingLines.map((line, idx) => (
                                <div key={idx}>{line}</div>
                            ))}
                        </div>
                    )}

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
                                            <button type="button" onClick={() => onRemoveQueuedFile(u)} className="ml-1 text-gray-500 hover:text-gray-700">×</button>
                                        </span>
                                    );
                                })}
                            </div>
                        )}
                        {/* Quick Action Buttons */}
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                type="button"
                                className="text-xs h-7"
                                onClick={() => onQuickAction('Extract Invoice')}
                                disabled={isLoading}
                            >
                                Extract Invoice
                            </Button>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="Type a message..."
                                value={chatInput}
                                onChange={onInputChange}
                                onKeyDown={onInputKeyDown}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={handleDrop}
                                ref={inputRef}
                            />
                            <Button type="submit" size="sm" disabled={isLoading || !chatInput.trim()}>
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send"}
                            </Button>
                        </div>

                        {/* mention dropdown */}
                        {mentionActive && mentionSuggestions.length > 0 && (
                            <div className="absolute left-3 bottom-full mb-1 bg-white border rounded shadow-lg w-56 max-h-60 overflow-y-auto z-20 text-sm">
                                {mentionSuggestions.map((file, idx) => (
                                    <div key={file._id}
                                        className={`px-2 py-1 cursor-pointer ${idx === mentionIndex ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'}`}
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            onMentionSelect(file);
                                        }}
                                    >{file.fileName}</div>
                                ))}
                            </div>
                        )}
                    </form>
                </div>
            </ResizablePanel>
        </ResizablePanelGroup>
    );
}

export type { ChatPanelProps }; 