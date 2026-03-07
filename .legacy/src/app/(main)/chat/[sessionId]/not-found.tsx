import Link from "next/link";

export default function SessionNotFound() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center space-y-4">
        <h2 className="text-xl font-semibold">Session not found</h2>
        <p className="text-muted-foreground text-sm">
          This session doesn&apos;t exist or you don&apos;t have access to it.
        </p>
        <Link
          href="/dashboard"
          className="inline-block text-sm text-primary hover:underline"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
