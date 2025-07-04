"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";

interface FileItem {
  _id: string;
  fileUrl?: string | null;
  fileType?: string;
  fileName: string;
  fileSize?: number;
}

interface DocumentViewProps {
  files: FileItem[];
  previewIndex: number;
  onPreviewChange: (index: number) => void;
}

export default function DocumentView({ files, previewIndex, onPreviewChange }: DocumentViewProps) {
  const [isFileViewerLoading, setIsFileViewerLoading] = useState(false);

  useEffect(() => {
    setIsFileViewerLoading(true);
  }, [previewIndex]);

  const currentFile = files[previewIndex];

  return (
    <div className="h-full border-r overflow-hidden" style={{ minWidth: "300px" }}>
      {/* Header with selector */}
      <div className="p-4 py-2 border-b bg-gray-50">
        <div className="flex justify-between items-center">
          <p className="font-medium">Source Document</p>
          {files.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Preview:</span>
              <select
                value={previewIndex}
                onChange={(e) => onPreviewChange(Number(e.target.value))}
                className="text-sm border border-gray-300 rounded px-2 py-1 bg-white max-w-48"
              >
                {files.map((file, index) => (
                  <option key={file._id} value={index}>
                    {file.fileName} ({Math.round((file.fileSize || 0) / 1024)}KB)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Preview Area */}
      <div className="h-full relative overflow-auto">
        {isFileViewerLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        )}

        {currentFile?.fileType?.startsWith("image") ? (
          <Image
            src={currentFile?.fileUrl || "#"}
            alt="preview"
            className="max-w-full h-auto mx-auto"
            onLoad={() => setIsFileViewerLoading(false)}
            onError={() => setIsFileViewerLoading(false)}
            width={1000}
            height={1000}
          />
        ) : (
          <embed
            src={`${currentFile?.fileUrl || ""}#toolbar=0&navpanes=0&scrollbar=0`}
            type="application/pdf"
            width="100%"
            height="100%"
            className="w-full h-full"
            onLoad={() => setIsFileViewerLoading(false)}
            onError={() => setIsFileViewerLoading(false)}
          />
        )}
      </div>
    </div>
  );
} 