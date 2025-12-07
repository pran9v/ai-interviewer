import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LinkExpiredPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center border border-gray-100">
        <h1 className="text-2xl font-semibold mb-2">This link has expired</h1>
        <p className="text-gray-500 mb-6">
          The interview link is no longer valid. Ask the recruiter to send you a
          fresh link.
        </p>
        <Button asChild className="rounded-full">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </main>
  );
}

