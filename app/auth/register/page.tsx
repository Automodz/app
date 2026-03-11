'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// No separate register flow — Google handles sign up automatically on first login
export default function RegisterRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/auth/login'); }, [router]);
  return null;
}
