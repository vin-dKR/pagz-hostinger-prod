/**
 * Not Found Page
 * 404 error page
 */

import Link from 'next/link';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardContent className="py-12 text-center">
          <h1 className="text-6xl font-bold text-gray-900">404</h1>
          <h2 className="mt-4 text-2xl font-semibold text-gray-800">Page Not Found</h2>
          <p className="mt-2 text-gray-600">
            The page you're looking for doesn't exist.
          </p>
          <Link href="/dashboard">
            <Button className="mt-6">Go to Dashboard</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

