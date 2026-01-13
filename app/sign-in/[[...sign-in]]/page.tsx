"use client";

import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-slate-950 px-6 py-12">
      <div className="mx-auto max-w-md">
        <SignIn
          routing="path"
          path="/sign-in"
          afterSignInUrl="/onboarding"
          signUpUrl="/sign-up"
        />
      </div>
    </div>
  );
}
