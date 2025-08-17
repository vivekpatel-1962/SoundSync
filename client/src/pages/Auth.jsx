import React from 'react';
import { SignIn } from '@clerk/clerk-react';

export default function Auth() {
  return (
    <div className="min-h-[70vh] grid place-items-center">
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" afterSignInUrl="/" />
    </div>
  );
}
