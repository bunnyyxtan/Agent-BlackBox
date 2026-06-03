type AgentBlackBoxLogoSize = "sm" | "md" | "lg";

const sizeClasses: Record<AgentBlackBoxLogoSize, { box: string; image: string }> = {
  sm: { box: "h-8 w-8 rounded-lg", image: "h-7 w-7" },
  md: { box: "h-9 w-9 rounded-xl", image: "h-8 w-8" },
  lg: { box: "h-11 w-11 rounded-xl", image: "h-10 w-10" },
};

export function AgentBlackBoxLogo({
  className = "",
  container = true,
  size = "md",
}: {
  className?: string;
  container?: boolean;
  size?: AgentBlackBoxLogoSize;
}) {
  const classes = sizeClasses[size];
  const image = (
    <img
      alt="Agent BlackBox logo"
      className={`${container ? classes.image : classes.box} object-contain`}
      height={size === "lg" ? 40 : size === "md" ? 32 : 28}
      src="/brand/agent-blackbox-logo.png"
      width={size === "lg" ? 40 : size === "md" ? 32 : 28}
    />
  );

  if (!container) return image;

  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden border border-white/10 bg-black/60 shadow-[0_0_18px_-6px_rgba(124,58,237,0.7)] ${classes.box} ${className}`}
    >
      {image}
    </span>
  );
}
