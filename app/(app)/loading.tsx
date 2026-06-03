export default function AppLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="h-3 w-36 animate-pulse rounded-full bg-indigo-400/20" />
          <div className="mt-4 h-9 w-72 max-w-full animate-pulse rounded-full bg-white/10" />
          <div className="mt-3 h-4 w-96 max-w-full animate-pulse rounded-full bg-white/[0.055]" />
        </div>
        <div className="h-11 w-36 animate-pulse rounded-full bg-white/10" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div
            className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 shadow-[0_24px_80px_-60px_rgba(99,102,241,0.45)]"
            key={item}
          >
            <div className="h-9 w-9 animate-pulse rounded-xl bg-indigo-400/15" />
            <div className="mt-6 h-3 w-24 animate-pulse rounded-full bg-white/10" />
            <div className="mt-3 h-7 w-16 animate-pulse rounded-full bg-white/15" />
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_21rem]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
          <div className="h-4 w-32 animate-pulse rounded-full bg-white/10" />
          <div className="mt-5 space-y-3">
            {[0, 1, 2, 3].map((item) => (
              <div className="h-20 animate-pulse rounded-2xl bg-white/[0.04]" key={item} />
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-cyan/15 bg-cyan/[0.035] p-5">
          <div className="h-4 w-40 animate-pulse rounded-full bg-cyan/20" />
          <div className="mt-5 h-48 animate-pulse rounded-2xl bg-white/[0.04]" />
        </div>
      </div>
    </div>
  );
}
