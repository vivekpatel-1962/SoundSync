import React from 'react';
import { SignUp } from '@clerk/clerk-react';

export default function SignUpPage() {
  return (
    <div className="min-h-[70vh] grid place-items-center">
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" afterSignUpUrl="/" />
    </div>
  );
}
