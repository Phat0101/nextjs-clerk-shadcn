"use client";

import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CommissionSettingsView() {
  const [compilerCommission, setCompilerCommission] = useState(70);
  const [companyCommission, setCompanyCommission] = useState(30);
  const [isSaving, setIsSaving] = useState(false);
  
  const commissionSettings = useQuery(api.systemSettings.getCommissionSettings);
  const updateCommissionSetting = useMutation(api.systemSettings.updateCommissionSetting);
  const initializeSettings = useMutation(api.systemSettings.initializeDefaultSettings);

  // Update local state when settings are loaded
  React.useEffect(() => {
    if (commissionSettings) {
      setCompilerCommission(commissionSettings.compilerCommission || 70);
      setCompanyCommission(commissionSettings.companyCommission || 30);
    }
  }, [commissionSettings]);

  const handleSaveSettings = async () => {
    if (compilerCommission + companyCommission !== 100) {
      alert("Commission percentages must add up to 100%");
      return;
    }

    setIsSaving(true);
    try {
      await updateCommissionSetting({
        key: "compilerCommission",
        value: compilerCommission,
        description: "Percentage of job price that goes to the compiler"
      });
      
      await updateCommissionSetting({
        key: "companyCommission",
        value: companyCommission,
        description: "Percentage of job price that goes to the company"
      });
      
      alert("Commission settings updated successfully!");
    } catch (error) {
      console.error("Failed to update commission settings", error);
      alert("Failed to update commission settings");
    }
    setIsSaving(false);
  };

  const handleInitializeDefaults = async () => {
    try {
      await initializeSettings();
      alert("Default settings initialized!");
    } catch (error) {
      console.error("Failed to initialize settings", error);
      alert("Failed to initialize settings");
    }
  };

  if (commissionSettings === undefined) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Commission Settings</h1>
          <p className="text-gray-600">Manage how revenue is split between compilers and the company</p>
        </div>
        <Button onClick={handleInitializeDefaults} variant="outline">
          Reset to Defaults
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue Split Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="compilerCommission">Compiler Commission (%)</Label>
              <Input
                id="compilerCommission"
                type="number"
                min="0"
                max="100"
                value={compilerCommission}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 0;
                  setCompilerCommission(value);
                  setCompanyCommission(100 - value);
                }}
              />
              <p className="text-sm text-gray-500 mt-1">
                Percentage of each job payment that goes to the compiler
              </p>
            </div>

            <div>
              <Label htmlFor="companyCommission">Company Commission (%)</Label>
              <Input
                id="companyCommission"
                type="number"
                min="0"
                max="100"
                value={companyCommission}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 0;
                  setCompanyCommission(value);
                  setCompilerCommission(100 - value);
                }}
              />
              <p className="text-sm text-gray-500 mt-1">
                Percentage of each job payment that goes to the company
              </p>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Commission Split Preview</h4>
            <div className="text-sm text-gray-600">
              <p>For a $35.00 job:</p>
              <p>• Compiler receives: ${((3500 * compilerCommission) / 10000).toFixed(2)}</p>
              <p>• Company receives: ${((3500 * companyCommission) / 10000).toFixed(2)}</p>
              <p className={`mt-2 ${compilerCommission + companyCommission === 100 ? 'text-green-600' : 'text-red-600'}`}>
                Total: {compilerCommission + companyCommission}% 
                {compilerCommission + companyCommission !== 100 && " (Must equal 100%)"}
              </p>
            </div>
          </div>

          <Button 
            onClick={handleSaveSettings} 
            disabled={isSaving || compilerCommission + companyCommission !== 100}
            className="w-full"
          >
            {isSaving ? "Saving..." : "Save Commission Settings"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Important Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>• Commission rates apply to all new jobs going forward</li>
            <li>• Existing jobs maintain their original commission structure</li>
            <li>• Compilers only see their portion of the job price when browsing available jobs</li>
            <li>• Revenue is only calculated when jobs are marked as completed</li>
            <li>• Changes take effect immediately after saving</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
} 