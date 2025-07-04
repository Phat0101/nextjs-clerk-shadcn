"use client";

import React from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { UserButton } from "@clerk/nextjs";

import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Plus,
  Briefcase,
  CheckSquare,
  BarChart3,
  SquarePen
} from "lucide-react";

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

export default function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const currentUser = useQuery(api.users.getCurrent);
  const stats = useQuery(api.myFunctions.getDashboardStats);
  const ensureUser = useMutation(api.users.ensureUser);
  const updateRole = useMutation(api.users.updateRole);
  const [collapsed, setCollapsed] = React.useState(true);
  // Track whether the role select dropdown is open to avoid collapsing during interaction
  const [selectOpen, setSelectOpen] = React.useState(false);

  // Ensure user exists on component mount
  React.useEffect(() => {
    if (currentUser === null) {
      ensureUser();
    }
  }, [currentUser, ensureUser]);

  const handleRoleChange = async (newRole: "CLIENT" | "COMPILER" | "ADMIN") => {
    if (!currentUser) return;
    
    try {
      await updateRole({ 
        userId: currentUser._id, 
        role: newRole 
      });
    } catch (error) {
      console.error("Error updating role:", error);
    }
  };

  if (!currentUser) {
    return (
      <div className="w-64 bg-gray-50 border-r border-gray-200 h-screen p-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const getNavigationItems = () => {
    const baseItems = [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        active: currentView === "dashboard"
      }
    ];

    switch (currentUser.role) {
      case "CLIENT":
        return [
          {
            id: "my-jobs",
            label: "My Jobs",
            icon: FileText,
            active: currentView === "my-jobs"
          },
          {
            id: "finished-jobs",
            label: "Finished Jobs",
            icon: CheckSquare,
            active: currentView === "finished-jobs"
          },
          {
            id: "create-job",
            label: "New Job",
            icon: Plus,
            active: currentView === "create-job"
          }
        ];
      
      case "COMPILER":
        return [
          ...baseItems,
          {
            id: "available-jobs",
            label: "Available Jobs",
            icon: Briefcase,
            active: currentView === "available-jobs"
          },
          {
            id: "active-jobs",
            label: "Active Jobs", 
            icon: SquarePen,
            active: currentView === "active-jobs"
          },
          {
            id: "completed-jobs",
            label: "Completed Jobs",
            icon: CheckSquare,
            active: currentView === "completed-jobs"
          }
        ];
      
      case "ADMIN":
        return [
          {
            id: "all-jobs",
            label: "All Jobs",
            icon: FileText,
            active: currentView === "all-jobs"
          },
          {
            id: "pricing",
            label: "Job Pricing",
            icon: Plus,
            active: currentView === "pricing"
          },
          {
            id: "commission-settings",
            label: "Commission Settings",
            icon: BarChart3,
            active: currentView === "commission-settings"
          },
          {
            id: "users",
            label: "User Management",
            icon: Users,
            active: currentView === "users"
          },
          {
            id: "analytics",
            label: "Analytics",
            icon: LayoutDashboard,
            active: currentView === "analytics"
          }
        ];
      
      default:
        return baseItems;
    }
  };

  const navigationItems = getNavigationItems();

  return (
    <div
      className={`fixed top-0 left-0 bg-white border-r border-gray-200 h-screen flex flex-col transition-all duration-200 ${collapsed ? 'w-16' : 'w-64'}`}
      onMouseEnter={() => setCollapsed(false)}
      onMouseLeave={() => {
        if (!selectOpen) setCollapsed(true);
      }}
    >
      {/* Header */}
      <div className="p-4 border-gray-200 flex flex-col gap-3">
        {/* Top row with logo only – sidebar expands via hover */}
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <div className={`w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center ${collapsed ? 'h-4 w-4 p-2 mr-1' : ''}`}>
            <span className="text-white font-bold text-sm">CF</span>
          </div>
        </div>

        {!collapsed && (
          <>
            {/* Role Switcher for Testing */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Current Role
                </span>
                <Badge variant={currentUser.role === "ADMIN" ? "default" : "secondary"}>
                  {currentUser.role}
                </Badge>
              </div>
              <Select
                value={currentUser.role}
                onValueChange={(val) => {
                  handleRoleChange(val as "CLIENT" | "COMPILER" | "ADMIN");
                }}
                onOpenChange={(open: boolean) => setSelectOpen(open)}
              >
                <SelectTrigger className="w-full h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLIENT">CLIENT</SelectItem>
                  <SelectItem value="COMPILER">COMPILER</SelectItem>
                  <SelectItem value="ADMIN">ADMIN</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>

      {/* Navigation */}
      <div className={`flex-1 ${collapsed ? 'p-1' : 'p-4'}`}>
        <div className="space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={
                  `w-full flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-lg text-sm font-medium transition-colors
                  ${item.active ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`
                }
              >
                <Icon className="w-4 h-4" />
                {!collapsed && item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Dashboard Summary for Clients */}
      {!collapsed && currentUser.role === "CLIENT" && stats && (
        <div className="p-4 border-t border-gray-200">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
            Dashboard Summary
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">Jobs Done</span>
              <span className="text-sm font-semibold text-green-600">{stats.completedJobs}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">Total Spent</span>
              <span className="text-sm font-semibold text-blue-600">
                ${((stats.totalCost || 0) / 100).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">Avg. Cost</span>
              <span className="text-sm font-semibold text-purple-600">
                ${((stats.averageCost || 0) / 100).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">Avg. Time</span>
              <span className="text-sm font-semibold text-orange-600">
                {(stats.averageCompletionTime ?? 0).toFixed(1)}h
              </span>
            </div>
            {((stats.pendingJobs || 0) > 0 || (stats.inProgressJobs || 0) > 0) && (
              <div className="pt-2 border-t border-gray-100">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-orange-600">Pending: {stats.pendingJobs || 0}</span>
                  <span className="text-blue-600">In Progress: {stats.inProgressJobs || 0}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* User Profile */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3">
          <UserButton />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {currentUser.name}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {currentUser.email}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 