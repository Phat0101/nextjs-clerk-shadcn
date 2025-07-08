import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import JobCursorPage from '../app/(authenticated)/jobs/[jobId]/page';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock Convex
jest.mock('convex/react', () => ({
  useQuery: jest.fn(),
  useMutation: jest.fn(),
}));

// Mock AI SDK
jest.mock('@ai-sdk/react', () => ({
  useChat: jest.fn(() => ({
    messages: [],
    input: '',
    handleInputChange: jest.fn(),
    handleSubmit: jest.fn(),
    isLoading: false,
    append: jest.fn(),
  })),
}));

// Mock React.use for Next.js 15
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  use: jest.fn((promise) => promise),
}));

describe('Job Switcher', () => {
  const mockPush = jest.fn();
  const mockRouter = {
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
  };

  const mockJobDetails = {
    job: {
      _id: 'job123',
      title: 'Test Job',
      deadline: Date.now() + 86400000, // 24 hours from now
    },
    files: [],
  };

  const mockRecentJobs = [
    {
      _id: 'job123',
      title: 'Current Job',
      deadline: Date.now() + 86400000,
      status: 'IN_PROGRESS',
    },
    {
      _id: 'job456',
      title: 'Another Job',
      deadline: Date.now() + 172800000,
      status: 'IN_PROGRESS',
    },
    {
      _id: 'job789',
      title: 'Third Job',
      deadline: Date.now() + 259200000,
      status: 'RECEIVED',
    },
  ];

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useQuery as jest.Mock).mockImplementation((query) => {
      if (query.toString().includes('getDetails')) {
        return mockJobDetails;
      }
      if (query.toString().includes('getMyActive')) {
        return mockRecentJobs;
      }
      if (query.toString().includes('getForClient')) {
        return [];
      }
      if (query.toString().includes('getAll')) {
        return [];
      }
      return [];
    });

    // Mock window.location.href
    delete (window as any).location;
    (window as any).location = { href: '' };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders job switcher button with current job info', () => {
    const props = {
      params: Promise.resolve({ jobId: 'job123' }),
    };

    render(<JobCursorPage {...props} />);

    // Check if the job switcher button is rendered
    expect(screen.getByText('Job-job123')).toBeInTheDocument();
    expect(screen.getByText('Test Job')).toBeInTheDocument();
  });

  test('opens dropdown when job switcher button is clicked', async () => {
    const props = {
      params: Promise.resolve({ jobId: 'job123' }),
    };

    render(<JobCursorPage {...props} />);

    // Find and click the job switcher button
    const switcherButton = screen.getByRole('button', { name: /Job-job123.*Test Job/i });
    fireEvent.click(switcherButton);

    // Wait for dropdown to appear
    await waitFor(() => {
      expect(screen.getByText('Current Job')).toBeInTheDocument();
      expect(screen.getByText('Another Job')).toBeInTheDocument();
      expect(screen.getByText('Third Job')).toBeInTheDocument();
    });
  });

  test('highlights current job in blue', async () => {
    const props = {
      params: Promise.resolve({ jobId: 'job123' }),
    };

    render(<JobCursorPage {...props} />);

    // Open dropdown
    const switcherButton = screen.getByRole('button', { name: /Job-job123.*Test Job/i });
    fireEvent.click(switcherButton);

    await waitFor(() => {
      // Find the current job in the dropdown
      const currentJobElement = screen.getByText('Job-job123');
      expect(currentJobElement).toHaveClass('text-blue-600');
    });
  });

  test('navigates to different job when clicked', async () => {
    const props = {
      params: Promise.resolve({ jobId: 'job123' }),
    };

    render(<JobCursorPage {...props} />);

    // Open dropdown
    const switcherButton = screen.getByRole('button', { name: /Job-job123.*Test Job/i });
    fireEvent.click(switcherButton);

    await waitFor(() => {
      // Click on a different job
      const anotherJobButton = screen.getByText('Another Job').closest('button');
      expect(anotherJobButton).toBeInTheDocument();
      
      fireEvent.click(anotherJobButton!);
    });

    // Check if window.location.href was set correctly
    expect(window.location.href).toBe('/jobs/job456');
  });

  test('closes dropdown after job selection', async () => {
    const props = {
      params: Promise.resolve({ jobId: 'job123' }),
    };

    render(<JobCursorPage {...props} />);

    // Open dropdown
    const switcherButton = screen.getByRole('button', { name: /Job-job123.*Test Job/i });
    fireEvent.click(switcherButton);

    await waitFor(() => {
      const anotherJobButton = screen.getByText('Another Job').closest('button');
      fireEvent.click(anotherJobButton!);
    });

    // Dropdown should close (job titles should not be visible)
    await waitFor(() => {
      expect(screen.queryByText('Another Job')).not.toBeInTheDocument();
    });
  });

  test('shows up to 10 recent jobs', () => {
    const manyJobs = Array.from({ length: 15 }, (_, i) => ({
      _id: `job${i}`,
      title: `Job ${i}`,
      deadline: Date.now() + (i * 86400000),
      status: 'IN_PROGRESS',
    }));

    (useQuery as jest.Mock).mockImplementation((query) => {
      if (query.toString().includes('getDetails')) {
        return mockJobDetails;
      }
      if (query.toString().includes('getMyActive')) {
        return manyJobs;
      }
      return [];
    });

    const props = {
      params: Promise.resolve({ jobId: 'job123' }),
    };

    render(<JobCursorPage {...props} />);

    // Open dropdown
    const switcherButton = screen.getByRole('button', { name: /Job-job123.*Test Job/i });
    fireEvent.click(switcherButton);

    // Should only show 10 jobs (limited by slice(0, 10))
    const jobButtons = screen.getAllByText(/Job \d+/);
    expect(jobButtons.length).toBeLessThanOrEqual(10);
  });
});
