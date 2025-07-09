import React from "react";
import DocumentView from "./documentView";

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

interface FilesAndDocumentPanelProps {
    displayFiles: JobFile[];
    previewIndex: number;
    onPreviewChange: (index: number) => void;
}

export default function FilesAndDocumentPanel({
    displayFiles,
    previewIndex,
    onPreviewChange,
}: FilesAndDocumentPanelProps) {
    return (
        <div className="h-full">
            {displayFiles.length > 0 ? (
                <DocumentView files={displayFiles} previewIndex={previewIndex} onPreviewChange={onPreviewChange} />
            ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-xs">No files</div>
            )}
        </div>
    );
}

export type { JobFile, FilesAndDocumentPanelProps }; 