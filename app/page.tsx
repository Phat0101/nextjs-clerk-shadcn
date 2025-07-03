"use client";

import React from "react";
import { Authenticated, Unauthenticated } from "convex/react";
import { SignUpButton, SignInButton, UserButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <>
      <header className="sticky top-0 z-10 bg-background p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">CompileFlow</h1>
        </div>
        <Authenticated>
          <div className="flex items-center gap-4">
            <DashboardButton />
            <UserButton />
          </div>
        </Authenticated>
        <Unauthenticated>
          <div className="flex items-center gap-2">
            <SignInButton mode="modal">
              <Button variant="outline">Sign in</Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button>Sign up</Button>
            </SignUpButton>
          </div>
        </Unauthenticated>
      </header>
      <main className="p-8 flex flex-col gap-8">
        <Authenticated>
          <AuthenticatedContent />
        </Authenticated>
        <Unauthenticated>
          <LandingPage />
        </Unauthenticated>
      </main>
    </>
  );
}

function DashboardButton() {
  const router = useRouter();
  return (
    <Button onClick={() => router.push('/dashboard')} variant="outline">
      Dashboard
    </Button>
  );
}

function AuthenticatedContent() {
  const router = useRouter();
  
  React.useEffect(() => {
    router.push('/dashboard');
  }, [router]);

  return (
    <div className="flex flex-col items-center gap-4">
      <h2 className="text-2xl font-bold">Welcome to CompileFlow</h2>
      <p>Redirecting you to your dashboard...</p>
    </div>
  );
}

function LandingPage() {
  return (
    <div className="max-w-4xl mx-auto text-center">
      <h1 className="text-6xl font-bold text-center mb-6">
        CompileFlow
      </h1>
      <p className="text-xl text-muted-foreground mb-8">
        Real-time, outcome-based outsourcing platform for document data extraction
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        <div className="p-6 border rounded-lg">
          <h3 className="text-xl font-semibold mb-3">For Clients</h3>
          <p className="text-muted-foreground">
            Upload your documents and get accurate data extraction with transparent pricing and real-time progress tracking.
          </p>
        </div>
        <div className="p-6 border rounded-lg">
          <h3 className="text-xl font-semibold mb-3">For Compilers</h3>
          <p className="text-muted-foreground">
            Find flexible work opportunities with immediate payments and work from anywhere on your own schedule.
          </p>
        </div>
        <div className="p-6 border rounded-lg">
          <h3 className="text-xl font-semibold mb-3">Pay-per-Outcome</h3>
          <p className="text-muted-foreground">
            No hourly rates or retainers. Pay a fixed price per document with guaranteed quality results.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <SignUpButton mode="modal">
          <Button size="lg">Get Started</Button>
        </SignUpButton>
        <SignInButton mode="modal">
          <Button variant="outline" size="lg">Sign In</Button>
        </SignInButton>
      </div>
    </div>
  );
}
