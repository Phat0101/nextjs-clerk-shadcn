/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownProps {
  content: string;
  className?: string;
}

export default function Markdown({ content, className }: MarkdownProps) {
  return (
    <div className={className ?? "prose prose-sm max-w-none"}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props: any) => (
            <h1 {...props} className="mt-4 mb-2 text-2xl font-bold" />
          ),
          h2: (props: any) => (
            <h2 {...props} className="mt-3 mb-1 text-xl font-semibold" />
          ),
          code({ inline, children, className }: any) {
            if (inline) {
              return (
                <code className={`rounded bg-muted/40 px-1 py-0.5 font-mono text-xs ${className || ''}`}>
                  {children}
                </code>
              );
            }
            return (
              <pre className={`overflow-x-auto rounded bg-muted/40 p-3 text-xs ${className || ''}`}>
                <code>{children}</code>
              </pre>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
} 