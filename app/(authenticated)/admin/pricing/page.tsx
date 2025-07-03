"use client";

import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Edit, Trash2, DollarSign } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";

export default function PricingManagementPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [editingUnit, setEditingUnit] = useState<string | null>(null);
  
  const priceUnits = useQuery(api.priceUnits.getAll);
  const createPriceUnit = useMutation(api.priceUnits.create);
  const updatePriceUnit = useMutation(api.priceUnits.update);
  const deletePriceUnit = useMutation(api.priceUnits.remove);

  const handleCreateUnit = async (formData: FormData) => {
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const amount = parseFloat(formData.get("amount") as string) * 100; // Convert to cents
    const currency = formData.get("currency") as string;

    if (!name || !description || !amount || !currency) {
      alert("Please fill in all fields");
      return;
    }

    try {
      await createPriceUnit({ name, description, amount, currency });
      setIsCreating(false);
    } catch (error) {
      console.error("Error creating price unit:", error);
      alert("Error creating price unit");
    }
  };

  const handleUpdateUnit = async (formData: FormData, unitId: string) => {
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const amount = parseFloat(formData.get("amount") as string) * 100; // Convert to cents
    const currency = formData.get("currency") as string;
    const isActive = formData.get("isActive") === "true";

    if (!name || !description || !amount || !currency) {
      alert("Please fill in all fields");
      return;
    }

    try {
      await updatePriceUnit({ 
        id: unitId as Id<"priceUnits">, 
        name, 
        description, 
        amount, 
        currency, 
        isActive 
      });
      setEditingUnit(null);
    } catch (error) {
      console.error("Error updating price unit:", error);
      alert("Error updating price unit");
    }
  };

  const handleDeleteUnit = async (unitId: string) => {
    if (!confirm("Are you sure you want to delete this price unit?")) {
      return;
    }

    try {
      await deletePriceUnit({ id: unitId as Id<"priceUnits"> });
    } catch (error) {
      console.error("Error deleting price unit:", error);
      alert("Error deleting price unit");
    }
  };

  if (priceUnits === undefined) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pricing Management</h1>
          <p className="text-gray-600">Create and manage flat-rate pricing for different job types</p>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Price Unit
        </Button>
      </div>

      {/* Create New Price Unit Form */}
      {isCreating && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Price Unit</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={handleCreateUnit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Price Unit Name</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="e.g., Standard Document Processing"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <Select name="currency" defaultValue="AUD">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AUD">AUD</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  name="description"
                  placeholder="Brief description of what this covers..."
                  required
                />
              </div>

              <div>
                <Label htmlFor="amount">Price Amount</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="amount"
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="35.00"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit">Create Price Unit</Button>
                <Button type="button" variant="outline" onClick={() => setIsCreating(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Price Units List */}
      <div className="space-y-4">
        {priceUnits.map((unit) => (
          <Card key={unit._id}>
            <CardContent className="p-6">
              {editingUnit === unit._id ? (
                <form action={(formData) => handleUpdateUnit(formData, unit._id)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`edit-name-${unit._id}`}>Price Unit Name</Label>
                      <Input
                        id={`edit-name-${unit._id}`}
                        name="name"
                        defaultValue={unit.name}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor={`edit-currency-${unit._id}`}>Currency</Label>
                      <Select name="currency" defaultValue={unit.currency}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AUD">AUD</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="GBP">GBP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor={`edit-description-${unit._id}`}>Description</Label>
                    <Input
                      id={`edit-description-${unit._id}`}
                      name="description"
                      defaultValue={unit.description}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`edit-amount-${unit._id}`}>Price Amount</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id={`edit-amount-${unit._id}`}
                          name="amount"
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={(unit.amount / 100).toFixed(2)}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor={`edit-status-${unit._id}`}>Status</Label>
                      <Select name="isActive" defaultValue={unit.isActive.toString()}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Active</SelectItem>
                          <SelectItem value="false">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit">Update</Button>
                    <Button type="button" variant="outline" onClick={() => setEditingUnit(null)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{unit.name}</h3>
                      <Badge variant={unit.isActive ? "default" : "secondary"}>
                        {unit.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-gray-600 mb-2">{unit.description}</p>
                    <p className="text-2xl font-bold text-green-600">
                      {unit.currency} ${(unit.amount / 100).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setEditingUnit(unit._id)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDeleteUnit(unit._id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        
        {priceUnits.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-gray-500 mb-4">No price units created yet.</p>
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Price Unit
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
} 