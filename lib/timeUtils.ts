export function getTimeRemaining(deadline: number): {
  total: number;
  days: number;
  hours: number;
  minutes: number;
  isOverdue: boolean;
} {
  const now = Date.now();
  const total = deadline - now;
  
  if (total <= 0) {
    return {
      total: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      isOverdue: true,
    };
  }

  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  const hours = Math.floor((total % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((total % (1000 * 60 * 60)) / (1000 * 60));

  return {
    total,
    days,
    hours,
    minutes,
    isOverdue: false,
  };
}

export function formatTimeRemaining(deadline: number): {
  text: string;
  isOverdue: boolean;
  urgency: 'overdue' | 'critical' | 'warning' | 'normal';
} {
  const time = getTimeRemaining(deadline);
  
  if (time.isOverdue) {
    return {
      text: 'Overdue',
      isOverdue: true,
      urgency: 'overdue',
    };
  }

  let text = '';
  if (time.days > 0) {
    text += `${time.days}d `;
  }
  if (time.hours > 0) {
    text += `${time.hours}h `;
  }
  if (time.days === 0 && time.minutes > 0) {
    text += `${time.minutes}m`;
  }
  
  text = text.trim() || 'Less than 1m';

  // Determine urgency
  const totalHours = time.total / (1000 * 60 * 60);
  let urgency: 'overdue' | 'critical' | 'warning' | 'normal' = 'normal';
  
  if (totalHours <= 1) {
    urgency = 'critical';
  } else if (totalHours <= 4) {
    urgency = 'warning';
  }

  return {
    text,
    isOverdue: false,
    urgency,
  };
}

export function formatDeadlineDate(deadline: number): string {
  return new Date(deadline).toLocaleString();
} 