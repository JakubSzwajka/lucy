export default function ChatLoading() {
  return (
    <div className="flex flex-col h-full w-full">
      {/* Header skeleton */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
        <div className="h-5 w-40 rounded bg-zinc-800 animate-pulse" />
        <div className="ml-auto h-5 w-24 rounded bg-zinc-800 animate-pulse" />
      </div>

      {/* Messages area skeleton */}
      <div className="flex-1 flex flex-col gap-4 p-4 overflow-hidden">
        <div className="h-4 w-3/4 rounded bg-zinc-800/50 animate-pulse" />
        <div className="h-4 w-1/2 rounded bg-zinc-800/50 animate-pulse" />
        <div className="h-4 w-2/3 rounded bg-zinc-800/50 animate-pulse self-end" />
      </div>

      {/* Input area skeleton */}
      <div className="px-4 py-3 border-t border-zinc-800">
        <div className="h-10 w-full rounded-lg bg-zinc-800 animate-pulse" />
      </div>
    </div>
  );
}
