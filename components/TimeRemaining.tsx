"use client";

import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { formatTimeRemaining } from "@/lib/timeUtils";

interface TimeRemainingProps {
  deadline: number;
  className?: string;
  showDate?: boolean;
  compact?: boolean;
}

export default function TimeRemaining({ deadline, className = "", showDate = false, compact = false }: TimeRemainingProps) {
  const [timeInfo, setTimeInfo] = useState(formatTimeRemaining(deadline));

  useEffect(() => {
    const updateTime = () => {
      setTimeInfo(formatTimeRemaining(deadline));
    };

    // Update immediately
    updateTime();

    // Update every minute
    const interval = setInterval(updateTime, 60000);

    return () => clearInterval(interval);
  }, [deadline]);

  const getVariant = () => {
    switch (timeInfo.urgency) {
      case 'overdue':
        return 'destructive';
      case 'critical':
        return 'destructive';
      case 'warning':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getTextColor = () => {
    switch (timeInfo.urgency) {
      case 'overdue':
        return 'text-red-600';
      case 'critical':
        return 'text-red-500';
      case 'warning':
        return 'text-orange-500';
      default:
        return 'text-gray-600';
    }
  };

  if (compact) {
    return (
      <Badge variant={getVariant()} className={`text-xs ${className}`}>
        {timeInfo.text}
      </Badge>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge variant={getVariant()}>
        {timeInfo.text}
      </Badge>
      {showDate && (
        <span className={`text-xs ${getTextColor()}`}>
          Due: {new Date(deadline).toLocaleDateString()} at {new Date(deadline).toLocaleTimeString()}
        </span>
      )}
    </div>
  );
} 