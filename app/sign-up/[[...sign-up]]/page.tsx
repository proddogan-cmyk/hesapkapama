"use client";

import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-slate-950 px-6 py-12">
      <div className="mx-auto max-w-md">
        <SignUp
          routing="path"
          path="/sign-up"
          afterSignUpUrl="/onboarding"
          signInUrl="/sign-in"
        />
      </div>
    </div>
  );
}
