/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, Eye, ExternalLink, Trash } from "lucide-react";

export default function InboxView() {
  const [selectedStatus, setSelectedStatus] = useState<"all" | "unread" | "read" | "processed" | "archived" | "sent" | "failed">("all");
  const [selectedType, setSelectedType] = useState<"all" | "inbound" | "outbound">("all");
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  
  const allEmails = useQuery(api.inbox.getAll);
  const inboxStats = useQuery(api.inbox.getStats);
  const markAsRead = useMutation(api.inbox.markAsRead);
  const updateStatus = useMutation(api.inbox.updateStatus);
  const deleteEmail = useMutation(api.inbox.deleteEmail);

  const handleMarkAsRead = async (emailId: string) => {
    try {
      await markAsRead({ emailId: emailId as any });
    } catch (error) {
      console.error("Error marking email as read:", error);
    }
  };

  const handleUpdateStatus = async (emailId: string, status: "unread" | "read" | "processed" | "archived" | "sent" | "failed") => {
    try {
      await updateStatus({ emailId: emailId as any, status });
    } catch (error) {
      console.error("Error updating email status:", error);
    }
  };

  const handleDeleteEmail = async (emailId: string) => {
    if (!confirm("Are you sure you want to delete this email? This action cannot be undone.")) {
      return;
    }

    try {
      await deleteEmail({ emailId: emailId as any });
    } catch (error) {
      console.error("Error deleting email:", error);
      alert("Error deleting email. Please try again.");
    }
  };

  if (allEmails === undefined || inboxStats === undefined) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Inbox Management</h1>
        <div>Loading...</div>
      </div>
    );
  }

  // Filter emails based on selected status and type
  const filteredEmails = allEmails.filter(email => {
    const statusMatch = selectedStatus === "all" || email.status === selectedStatus;
    const typeMatch = selectedType === "all" || email.type === selectedType;
    return statusMatch && typeMatch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "unread": return "bg-blue-100 text-blue-800";
      case "read": return "bg-gray-100 text-gray-800";
      case "processed": return "bg-green-100 text-green-800";
      case "archived": return "bg-purple-100 text-purple-800";
      case "sent": return "bg-emerald-100 text-emerald-800";
      case "failed": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "inbound": return "bg-cyan-100 text-cyan-800";
      case "outbound": return "bg-orange-100 text-orange-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "inbound": return "↓";
      case "outbound": return "↑";
      default: return "●";
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inbox Management</h1>
          <p className="text-gray-600">Monitor and manage inbound emails and track sent completion emails</p>
        </div>
      </div>

      {/* Enhanced Inbox Stats */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium text-gray-600">Total Emails</div>
            <div className="text-2xl font-bold">{inboxStats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium text-gray-600">Inbound</div>
            <div className="text-2xl font-bold text-cyan-600">{inboxStats.inbound}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium text-gray-600">Outbound</div>
            <div className="text-2xl font-bold text-orange-600">{inboxStats.outbound}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium text-gray-600">Unread</div>
            <div className="text-2xl font-bold text-blue-600">{inboxStats.unread}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium text-gray-600">Processed</div>
            <div className="text-2xl font-bold text-green-600">{inboxStats.processed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium text-gray-600">Sent</div>
            <div className="text-2xl font-bold text-emerald-600">{inboxStats.sent}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-medium text-gray-600">Failed</div>
            <div className="text-2xl font-bold text-red-600">{inboxStats.failed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Filters */}
      <div className="flex items-center gap-4">
        <div>
          <Label htmlFor="type-filter">Filter by type:</Label>
          <Select value={selectedType} onValueChange={(value: any) => setSelectedType(value)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="inbound">Inbound</SelectItem>
              <SelectItem value="outbound">Outbound</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="status-filter">Filter by status:</Label>
          <Select value={selectedStatus} onValueChange={(value: any) => setSelectedStatus(value)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="unread">Unread</SelectItem>
              <SelectItem value="read">Read</SelectItem>
              <SelectItem value="processed">Processed</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Email List */}
      <div className="space-y-4">
        {filteredEmails.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Mail className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium mb-2">No emails found</h3>
              <p className="text-sm text-gray-500">
                {selectedStatus === "all" && selectedType === "all"
                  ? "No emails have been received or sent yet." 
                  : `No ${selectedType === "all" ? "" : selectedType + " "}${selectedStatus === "all" ? "" : selectedStatus + " "}emails found.`}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredEmails.map((email) => (
            <Card key={email._id} className={`${email.status === "unread" ? "border-blue-200 bg-blue-50" : ""}`}>
              <CardContent className="p-4">
                <div className="space-y-3">
                  {/* Email Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-gray-900 truncate">
                            {email.subject || "No Subject"}
                          </h3>
                          <Badge className={getTypeColor(email.type)}>
                            {getTypeIcon(email.type)} {email.type}
                          </Badge>
                          <Badge className={getStatusColor(email.status)}>
                            {email.status}
                          </Badge>
                          {email.emailService && (
                            <Badge variant="outline" className="text-xs">
                              {email.emailService}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>
                            {email.type === "outbound" ? "To" : "From"}: 
                            {email.type === "outbound" 
                              ? (email.recipientEmail || email.to)
                              : (email.fromName ? `${email.fromName} <${email.from}>` : email.from)
                            }
                          </span>
                          {email.type === "outbound" && email.from && (
                            <span>From: {email.from}</span>
                          )}
                          <span>{new Date(email.date).toLocaleString()}</span>
                          {email.jobId && (
                            <Badge variant="outline" className="text-xs">
                              Job: {email.jobId.slice(-6)}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setExpandedEmail(expandedEmail === email._id ? null : email._id)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {email.status === "unread" && email.type === "inbound" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-blue-600"
                          onClick={() => handleMarkAsRead(email._id)}
                        >
                          <Mail className="w-4 h-4" />
                        </Button>
                      )}
                      <Select
                        value={email.status}
                        onValueChange={(status: any) => handleUpdateStatus(email._id, status)}
                      >
                        <SelectTrigger className="h-8 w-24 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {email.type === "inbound" ? (
                            <>
                              <SelectItem value="unread">Unread</SelectItem>
                              <SelectItem value="read">Read</SelectItem>
                              <SelectItem value="processed">Processed</SelectItem>
                              <SelectItem value="archived">Archived</SelectItem>
                            </>
                          ) : (
                            <>
                              <SelectItem value="sent">Sent</SelectItem>
                              <SelectItem value="failed">Failed</SelectItem>
                              <SelectItem value="archived">Archived</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-600"
                        onClick={() => handleDeleteEmail(email._id)}
                      >
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Email Details (Expanded) */}
                  {expandedEmail === email._id && (
                    <div className="border-t pt-3 space-y-3">
                      {/* Recipients for inbound emails */}
                      {email.type === "inbound" && email.toFull && email.toFull.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-1">Recipients:</h4>
                          <div className="text-sm text-gray-600 space-y-1">
                            {email.toFull.map((recipient, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <span>{recipient.name ? `${recipient.name} <${recipient.email}>` : recipient.email}</span>
                                {recipient.mailboxHash && (
                                  <Badge variant="outline" className="text-xs">
                                    +{recipient.mailboxHash}
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Error message for failed outbound emails */}
                      {email.type === "outbound" && email.status === "failed" && email.errorMessage && (
                        <div>
                          <h4 className="text-sm font-medium text-red-700 mb-1">Error Details:</h4>
                          <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                            {email.errorMessage}
                          </div>
                        </div>
                      )}

                      {/* Email Body */}
                      {email.textBody && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-1">Message:</h4>
                          <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded max-h-40 overflow-y-auto">
                            <pre className="whitespace-pre-wrap font-sans">{email.textBody}</pre>
                          </div>
                        </div>
                      )}

                      {/* Attachments */}
                      {email.attachments && email.attachments.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-1">
                            Attachments ({email.attachments.length}):
                          </h4>
                          <div className="space-y-1">
                            {email.attachments.map((attachment, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                                <span>{attachment.name}</span>
                                <span className="text-gray-400">
                                  ({(attachment.contentLength / 1024 / 1024).toFixed(1)} MB)
                                </span>
                                <span className="text-gray-400">{attachment.contentType}</span>
                                {attachment.storageId && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-blue-600"
                                    onClick={async () => {
                                      try {
                                        // Get the file URL from Convex storage
                                        const response = await fetch(`/api/file-url?storageId=${attachment.storageId}`);
                                        if (response.ok) {
                                          const { url } = await response.json();
                                          window.open(url, '_blank');
                                        } else {
                                          alert("Could not get file URL");
                                        }
                                      } catch (error) {
                                        console.error("Error getting file URL:", error);
                                        alert("Error opening file");
                                      }
                                    }}
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Job Link */}
                      {email.jobId && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-1">
                            {email.type === "inbound" ? "Created Job:" : "Related Job:"}
                          </h4>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">Job ID: {email.jobId.slice(-6)}</Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs text-blue-600"
                              onClick={() => {
                                // This would navigate to the job details
                                alert(`Navigate to job: ${email.jobId}`);
                              }}
                            >
                              View Job <ExternalLink className="w-3 h-3 ml-1" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Enhanced Metadata */}
                      <div className="text-xs text-gray-500 space-y-1 border-t pt-2">
                        <div>Message ID: {email.messageId}</div>
                        <div>Type: {email.type}</div>
                        <div>Created: {new Date(email.createdAt).toLocaleString()}</div>
                        {email.readAt && <div>Read: {new Date(email.readAt).toLocaleString()}</div>}
                        {email.processedAt && <div>Processed: {new Date(email.processedAt).toLocaleString()}</div>}
                        {email.sentAt && <div>Sent: {new Date(email.sentAt).toLocaleString()}</div>}
                        {email.emailService && <div>Service: {email.emailService}</div>}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
} 