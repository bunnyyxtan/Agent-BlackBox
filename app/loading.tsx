export default function RootLoading() {
  return (
    <div className="min-h-screen bg-[#050507] px-6 py-24 text-white lg:px-10">
      <div className="mx-auto max-w-5xl">
        <div className="h-3 w-44 animate-pulse rounded-full bg-indigo-400/20" />
        <div className="mt-6 h-14 w-full max-w-2xl animate-pulse rounded-full bg-white/10" />
        <div className="mt-4 h-5 w-full max-w-xl animate-pulse rounded-full bg-white/[0.06]" />
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div
              className="h-48 animate-pulse rounded-3xl border border-white/10 bg-white/[0.025]"
              key={item}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
