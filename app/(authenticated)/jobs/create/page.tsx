"use client";

import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Id } from "@/convex/_generated/dataModel";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, FileText } from "lucide-react";

interface PriceUnit {
  _id: string;
  name: string;
  description: string;
  amount: number;
  currency: string;
  jobType?: "INVOICE" | "SHIPMENT" | "N10";
  isActive: boolean;
}

export default function CreateJobPage() {
  const [title, setTitle] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [selectedPriceUnitId, setSelectedPriceUnitId] = useState<Id<"priceUnits"> | "">("");
  const [jobType, setJobType] = useState<"INVOICE" | "SHIPMENT" | "N10">("INVOICE");
  const [deadlineHours, setDeadlineHours] = useState<number>(24);
  const [isUploading, setIsUploading] = useState(false);
  
  const priceUnits = useQuery(api.priceUnits.getActive);
  
  const createJob = useMutation(api.jobs.createJob);
  const generateUploadUrl = useMutation(api.jobs.generateUploadUrl);
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const selectedPriceUnit = priceUnits?.find((unit: PriceUnit) => unit._id === selectedPriceUnitId);
  const totalPrice = selectedPriceUnit ? selectedPriceUnit.amount / 100 : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title || files.length === 0 || !selectedPriceUnitId) {
      alert("Please provide a title, select files, and choose a price unit");
      return;
    }

    setIsUploading(true);
    
    try {
      // Upload each original file to Convex storage
      const uploadedFiles = [] as Array<{fileName:string;fileStorageId:string;fileSize:number;fileType:string}>;
      for (const file of files){
        const uploadUrl = await generateUploadUrl();
        const resp = await fetch(uploadUrl,{method:'POST',headers:{'Content-Type':file.type},body:file});
        const { storageId } = await resp.json();
        uploadedFiles.push({
          fileName: file.name,
          fileStorageId: storageId,
          fileSize: file.size,
          fileType: file.type,
        });
      }
      
      // Create job with original files metadata
      await createJob({ 
        title, 
        priceUnitId: selectedPriceUnitId as Id<"priceUnits">, 
        deadlineHours,
        files: uploadedFiles,
      });
      
      // Redirect to dashboard
      router.push('/dashboard?view=my-jobs');
      
    } catch (error) {
      console.error("Error creating job:", error);
      alert("Error creating job. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create New Job</h1>
        <p className="text-muted-foreground">
          Upload a document for data extraction. Our compilers will process your document and extract the required data.
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Job Title</Label>
              <Input
                id="title"
                placeholder="e.g., Invoice Data Extraction - Invoice #12345"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            {/* Job Type Selection */}
            <div className="space-y-2">
              <Label htmlFor="jobType">Job Type</Label>
              <Select value={jobType} onValueChange={(val)=>{ setJobType(val as "INVOICE"|"SHIPMENT"|"N10"); setSelectedPriceUnitId(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select job type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INVOICE">Invoice Extraction</SelectItem>
                  <SelectItem value="SHIPMENT">Shipment Registration</SelectItem>
                  <SelectItem value="N10">N10 Registration</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Price Unit Selection */}
            <div className="space-y-2">
              <Label htmlFor="priceUnit">Price Unit</Label>
              <Select value={selectedPriceUnitId as string} onValueChange={(val)=>setSelectedPriceUnitId(val as Id<"priceUnits">)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a price unit" />
                </SelectTrigger>
                <SelectContent>
                  {priceUnits?.filter((unit: PriceUnit)=>((unit.jobType||"INVOICE")== jobType) && unit.isActive).map((unit: PriceUnit) => (
                    <SelectItem key={unit._id} value={unit._id}>
                      {unit.name} - {unit.currency} ${(unit.amount / 100).toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPriceUnit && (
                <p className="text-sm text-gray-600">
                  {selectedPriceUnit.description}
                </p>
              )}
            </div>

            {/* Deadline Selection */}
            <div className="space-y-2">
              <Label htmlFor="deadline">Deadline (hours)</Label>
              <Select value={deadlineHours.toString()} onValueChange={(value: string) => setDeadlineHours(Number(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select deadline" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">4 hours (Urgent)</SelectItem>
                  <SelectItem value="12">12 hours (Priority)</SelectItem>
                  <SelectItem value="24">24 hours (Standard)</SelectItem>
                  <SelectItem value="48">48 hours (Extended)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Job must be completed within {deadlineHours} hours from submission
              </p>
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label htmlFor="files">Document Files</Label>
              <Input
                id="files"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                multiple
                onChange={handleFileChange}
              />
              <p className="text-sm text-muted-foreground">
                Supported formats: PDF, PNG, JPG, JPEG (max 10MB each). Select multiple files.
              </p>
            </div>

            {/* Selected Files Display */}
            {files.length > 0 && (
              <div className="space-y-2">
                <Label>Selected Files ({files.length})</Label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">{file.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {(file.size / 1024 / 1024).toFixed(1)} MB
                        </Badge>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pricing Summary */}
            {selectedPriceUnit && files.length > 0 && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">Pricing Summary</h3>
                <div className="space-y-1 text-blue-800 text-sm">
                  <p>Service: {selectedPriceUnit.name}</p>
                  <p>Job price: {selectedPriceUnit.currency} ${(selectedPriceUnit.amount / 100).toFixed(2)}</p>
                  <p>Number of files: {files.length}</p>
                  <p className="font-semibold">
                    Total cost: {selectedPriceUnit.currency} ${totalPrice.toFixed(2)}
                  </p>
                  <p className="text-xs mt-2">
                    Payment is processed only after successful completion.
                  </p>
                </div>
              </div>
            )}

            <Button 
              type="submit" 
              disabled={isUploading || !title || files.length === 0 || !selectedPriceUnitId}
              className="w-full"
            >
              {isUploading ? "Creating Job..." : "Create Job"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 