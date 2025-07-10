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
import { Mail, Eye, ExternalLink, Trash, ChevronDown, ChevronRight } from "lucide-react";

export default function InboxView() {
  const [selectedStatus, setSelectedStatus] = useState<"all" | "unread" | "read" | "processed" | "archived" | "sent" | "failed">("all");
  const [selectedType, setSelectedType] = useState<"all" | "inbound" | "outbound">("all");
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [analyticsExpanded, setAnalyticsExpanded] = useState(false);

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
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Inbox Management</h1>
          <p className="text-sm text-gray-600">Monitor and manage inbound emails and track sent completion emails</p>
        </div>
      </div>

      {/* Enhanced Inbox Stats */}
      <div className="space-y-2">
        <div className="flex items-center justify-start">
          <h2 className="text-base font-medium text-gray-900 mr-2">Email Analytics</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAnalyticsExpanded(!analyticsExpanded)}
            className="h-6 w-6 p-0 bg-gray-100"
          >
            {analyticsExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </Button>
        </div>
        
        {analyticsExpanded && (
          <div className="overflow-hidden border border-gray-200 rounded-lg">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Metric</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Count</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="text-xs font-medium text-gray-900">Total Emails</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="text-lg font-semibold text-gray-900">{inboxStats.total}</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="text-xs text-gray-600">All email communications</span>
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="text-xs font-medium text-gray-900">Inbound Emails</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="text-lg font-semibold text-cyan-600">{inboxStats.inbound}</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="text-xs text-gray-600">Received from clients</span>
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="text-xs font-medium text-gray-900">Outbound Emails</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="text-lg font-semibold text-orange-600">{inboxStats.outbound}</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="text-xs text-gray-600">Sent to clients</span>
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="text-xs font-medium text-gray-900">Unread</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="text-lg font-semibold text-blue-600">{inboxStats.unread}</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="text-xs text-gray-600">Awaiting attention</span>
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="text-xs font-medium text-gray-900">Processed</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="text-lg font-semibold text-green-600">{inboxStats.processed}</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="text-xs text-gray-600">Converted to jobs</span>
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="text-xs font-medium text-gray-900">Sent Successfully</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="text-lg font-semibold text-emerald-600">{inboxStats.sent}</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="text-xs text-gray-600">Delivery confirmed</span>
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="text-xs font-medium text-gray-900">Failed</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="text-lg font-semibold text-red-600">{inboxStats.failed}</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="text-xs text-gray-600">Delivery failed</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Enhanced Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
        <div className="w-full sm:w-auto">
          <Label htmlFor="type-filter" className="text-xs font-medium mb-1 block">Filter by type:</Label>
          <Select value={selectedType} onValueChange={(value: any) => setSelectedType(value)}>
            <SelectTrigger className="w-full sm:w-40 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="inbound">Inbound</SelectItem>
              <SelectItem value="outbound">Outbound</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-auto">
          <Label htmlFor="status-filter" className="text-xs font-medium mb-1 block">Filter by status:</Label>
          <Select value={selectedStatus} onValueChange={(value: any) => setSelectedStatus(value)}>
            <SelectTrigger className="w-full sm:w-40 h-8 text-xs">
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
      <div className="space-y-2">
        {filteredEmails.length === 0 ? (
          <Card className="p-0">
            <CardContent className="p-0 text-center">
              <Mail className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <h3 className="text-base font-medium mb-1">No emails found</h3>
              <p className="text-xs text-gray-500">
                {selectedStatus === "all" && selectedType === "all"
                  ? "No emails have been received or sent yet."
                  : `No ${selectedType === "all" ? "" : selectedType + " "}${selectedStatus === "all" ? "" : selectedStatus + " "}emails found.`}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredEmails.map((email) => (
            <Card key={email._id} className={`${email.status === "unread" ? "border-blue-200 bg-blue-50" : ""} p-0`}>
              <CardContent className="p-2">
                <div className="space-y-2">
                  {/* Email Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-medium text-xs text-gray-900 truncate max-w-xs" title={email.subject || "No Subject"}>
                          {email.subject || "No Subject"}
                        </h3>
                        <Badge className={`${getTypeColor(email.type)} text-xs px-1 py-0.5 flex-shrink-0`}>
                          {getTypeIcon(email.type)} {email.type}
                        </Badge>
                        <Badge className={`${getStatusColor(email.status)} text-xs px-1 py-0.5 flex-shrink-0`}>
                          {email.status}
                        </Badge>
                        {email.emailService && (
                          <Badge variant="outline" className="text-xs px-1 py-0.5 flex-shrink-0">
                            {email.emailService}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-600 flex-wrap">
                        <span className="truncate max-w-xs" title={email.type === "outbound" ? (email.recipientEmail || email.to) : (email.fromName ? `${email.fromName} <${email.from}>` : email.from)}>
                          {email.type === "outbound" ? "To" : "From"}:
                          {email.type === "outbound"
                            ? (email.recipientEmail || email.to)
                            : (email.fromName ? `${email.fromName} <${email.from}>` : email.from)
                          }
                        </span>
                        {email.type === "outbound" && email.from && (
                          <span className="truncate max-w-xs" title={email.from}>From: {email.from}</span>
                        )}
                        <span className="flex-shrink-0">{new Date(email.date).toLocaleString()}</span>
                        {email.jobId && (
                          <Badge variant="outline" className="text-xs px-1 py-0.5 flex-shrink-0">
                            Job: {email.jobId}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => setExpandedEmail(expandedEmail === email._id ? null : email._id)}
                      >
                        <Eye className="w-3 h-3" />
                      </Button>
                      {email.status === "unread" && email.type === "inbound" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-blue-600"
                          onClick={() => handleMarkAsRead(email._id)}
                        >
                          <Mail className="w-3 h-3" />
                        </Button>
                      )}
                      <Select
                        value={email.status}
                        onValueChange={(status: any) => handleUpdateStatus(email._id, status)}
                      >
                        <SelectTrigger className="h-6 w-20 text-xs">
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
                        className="h-6 w-6 p-0 text-red-600"
                        onClick={() => handleDeleteEmail(email._id)}
                      >
                        <Trash className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Email Details (Expanded) */}
                  {expandedEmail === email._id && (
                    <div className="border-t pt-2 space-y-2">
                      {/* Recipients for inbound emails */}
                      {email.type === "inbound" && email.toFull && email.toFull.length > 0 && (
                        <div>
                          <h4 className="text-xs font-medium text-gray-700 mb-1">Recipients:</h4>
                          <div className="text-xs text-gray-600 space-y-1">
                            {email.toFull.map((recipient, idx) => (
                              <div key={idx} className="flex items-center gap-1 flex-wrap">
                                <span className="truncate max-w-xs" title={recipient.name ? `${recipient.name} <${recipient.email}>` : recipient.email}>
                                  {recipient.name ? `${recipient.name} <${recipient.email}>` : recipient.email}
                                </span>
                                {recipient.mailboxHash && (
                                  <Badge variant="outline" className="text-xs px-1 py-0.5 flex-shrink-0">
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
                          <h4 className="text-xs font-medium text-red-700 mb-1">Error Details:</h4>
                          <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                            {email.errorMessage}
                          </div>
                        </div>
                      )}

                      {/* Email Body */}
                      {email.textBody && (
                        <div>
                          <h4 className="text-xs font-medium text-gray-700 mb-1">Message:</h4>
                          <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded max-h-32 overflow-y-auto">
                            <pre className="whitespace-pre-wrap font-sans">{email.textBody}</pre>
                          </div>
                        </div>
                      )}

                      {/* Attachments */}
                      {email.attachments && email.attachments.length > 0 && (
                        <div>
                          <h4 className="text-xs font-medium text-gray-700 mb-1">
                            Attachments ({email.attachments.length}):
                          </h4>
                          <div className="space-y-1">
                            {email.attachments.map((attachment, idx) => (
                              <div key={idx} className="flex items-center gap-1 text-xs text-gray-600 flex-wrap">
                                <span className="truncate max-w-xs" title={attachment.name}>{attachment.name}</span>
                                <span className="text-gray-400 flex-shrink-0">
                                  ({(attachment.contentLength / 1024 / 1024).toFixed(1)} MB)
                                </span>
                                <span className="text-gray-400 flex-shrink-0">{attachment.contentType}</span>
                                {attachment.storageId && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-4 w-4 p-0 text-blue-600 flex-shrink-0"
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
                                    <ExternalLink className="w-2.5 h-2.5" />
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
                          <h4 className="text-xs font-medium text-gray-700 mb-1">
                            {email.type === "inbound" ? "Created Job:" : "Related Job:"}
                          </h4>
                          <div className="flex items-center gap-1 flex-wrap">
                            <Badge variant="outline" className="text-xs px-1 py-0.5">Job ID: {email.jobId.slice(-6)}</Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 px-1 text-xs text-blue-600"
                              onClick={() => {
                                // This would navigate to the job details
                                alert(`Navigate to job: ${email.jobId}`);
                              }}
                            >
                              View Job <ExternalLink className="w-2.5 h-2.5 ml-1" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Enhanced Metadata */}
                      <div className="text-xs text-gray-500 space-y-0.5 border-t pt-1">
                        <div className="truncate" title={email.messageId}>Message ID: {email.messageId}</div>
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