'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthInterceptor() {
  const router = useRouter();

  useEffect(() => {
    const original = window.fetch;
    window.fetch = async (...args) => {
      const response = await original(...args);
      if (response.status === 401) {
        router.push('/login');
        return response;
      }
      return response;
    };
    return () => {
      window.fetch = original;
    };
  }, [router]);

  return null;
}
