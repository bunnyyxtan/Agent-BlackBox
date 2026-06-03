import type { UserFacingError } from "@/lib/errors/user-facing-errors";

interface UserFacingErrorAlertProps {
  error: UserFacingError;
  tone?: "red" | "amber";
}

export function UserFacingErrorAlert({ error, tone = "red" }: UserFacingErrorAlertProps) {
  const style =
    tone === "amber"
      ? {
          shell: "border-amber-200/15 bg-amber-300/[0.045]",
          icon: "border-amber-200/15 bg-amber-200/[0.08] text-amber-200",
          title: "text-amber-50",
          body: "text-amber-50/75",
          details: "text-amber-50/55",
        }
      : {
          shell: "border-red-300/15 bg-red-500/[0.045]",
          icon: "border-red-300/15 bg-red-300/[0.08] text-red-200",
          title: "text-red-100",
          body: "text-red-100/75",
          details: "text-red-100/55",
        };

  return (
    <div className={`rounded-2xl border p-4 ${style.shell}`}>
      <div className="flex gap-3">
        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${style.icon}`}>
          <iconify-icon icon="solar:danger-triangle-line-duotone" className="text-lg" />
        </span>
        <div className="min-w-0">
          <p className={`text-xs font-semibold ${style.title}`}>{error.title}</p>
          <div className="mt-1 space-y-1">
            {error.lines.map((line) => (
              <p className={`text-xs leading-5 ${style.body}`} key={line}>
                {line}
              </p>
            ))}
          </div>
          {error.details && (
            <details className={`mt-2 text-xs ${style.details}`}>
              <summary className="cursor-pointer select-none transition hover:text-white">
                Technical Details
              </summary>
              <p className="mt-2 whitespace-pre-wrap break-words font-mono text-[0.68rem] leading-5">
                {error.details}
              </p>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
