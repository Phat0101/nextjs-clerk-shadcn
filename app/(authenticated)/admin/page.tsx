"use client";

import React from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Id } from "@/convex/_generated/dataModel";

export default function AdminPage() {
  const currentUser = useQuery(api.users.getCurrent);
  const allUsers = useQuery(api.users.getAll);
  const stats = useQuery(api.myFunctions.getDashboardStats);
  const updateRole = useMutation(api.users.updateRole);
  const router = useRouter();

  // Redirect if not admin
  React.useEffect(() => {
    if (currentUser && currentUser.role !== "ADMIN") {
      router.push('/dashboard');
    }
  }, [currentUser, router]);

  const handleRoleChange = async (userId: Id<"users">, newRole: "CLIENT" | "COMPILER" | "ADMIN") => {
    try {
      await updateRole({ 
        userId: userId as Id<"users">,
        role: newRole 
      });
    } catch (error) {
      console.error("Error updating role:", error);
      alert("Error updating user role. Please try again.");
    }
  };

  if (currentUser === undefined || allUsers === undefined) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  if (currentUser?.role !== "ADMIN") {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">
            You need admin privileges to access this page.
          </p>
        </div>
      </div>
    );
  }

  const clientUsers = allUsers.filter(user => user.role === "CLIENT");
  const compilerUsers = allUsers.filter(user => user.role === "COMPILER");
  const adminUsers = allUsers.filter(user => user.role === "ADMIN");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">User Management</h1>
        <p className="text-muted-foreground">
          Manage users, roles, and monitor system performance
        </p>
      </div>

      {/* System Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalJobs}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalClients}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Gross Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const gross = (stats as { grossRevenue?: number }).grossRevenue ?? 0;
                return <div className="text-2xl font-bold">${(gross / 100).toFixed(2)}</div>;
              })()}
            </CardContent>
          </Card>
        </div>
      )}

      {/* User Role Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Clients
              <Badge variant="outline">{clientUsers.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Users who upload documents for processing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Compilers
              <Badge variant="outline">{compilerUsers.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Users who process documents and extract data
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Admins
              <Badge variant="outline">{adminUsers.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Users with full system access and management capabilities
            </p>
          </CardContent>
        </Card>
      </div>

      {/* User Management */}
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>
            Manage user roles and permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {allUsers.map((user) => (
              <div key={user._id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <h3 className="font-medium">{user.name}</h3>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
                
                <div className="flex items-center gap-4">
                  <Badge 
                    variant={user.role === "ADMIN" ? "default" : "secondary"}
                  >
                    {user.role}
                  </Badge>
                  
                  <Select 
                    value={user.role} 
                    onValueChange={(value) => handleRoleChange(user._id, value as "CLIENT" | "COMPILER" | "ADMIN")}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CLIENT">CLIENT</SelectItem>
                      <SelectItem value="COMPILER">COMPILER</SelectItem>
                      <SelectItem value="ADMIN">ADMIN</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 