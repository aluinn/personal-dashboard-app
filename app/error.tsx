"use client";

// Shown instead of a blank page if something on a page throws.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto mt-16 max-w-lg rounded-sm border border-magenta/50 p-5">
      <div className="micro text-magenta">Something went wrong</div>
      <p className="mt-2 text-sm text-muted">
        This page couldn&apos;t load. If you just deployed, the most common cause is a database setting (Vercel → Settings → Environment Variables), which needs a redeploy
        after any change.
      </p>
      {error.digest && <p className="micro mt-2 normal-case tracking-wide">Error id: {error.digest} (find it in Vercel → Logs)</p>}
      <button onClick={reset} className="btn mt-4">Try again</button>
    </div>
  );
}
