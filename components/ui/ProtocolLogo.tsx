export type Protocol = "sui" | "walrus" | "tatum";
type ProtocolLogoSize = "sm" | "md" | "lg";

const LOGOS: Record<Protocol, { src: string; alt: string }> = {
  sui: { src: "/logos/sui.png", alt: "Sui logo" },
  walrus: { src: "/logos/walrus.png", alt: "Walrus logo" },
  tatum: { src: "/logos/tatum.png", alt: "Tatum logo" },
};

const sizeClasses: Record<ProtocolLogoSize, { box: string; image: string }> = {
  sm: { box: "h-5 w-5 rounded-full", image: "h-3.5 w-3.5" },
  md: { box: "h-8 w-8 rounded-full", image: "h-5 w-5" },
  lg: { box: "h-10 w-10 rounded-full", image: "h-7 w-7" },
};

export function ProtocolLogo({
  className = "",
  protocol,
  size = "md",
}: {
  className?: string;
  protocol: Protocol;
  size?: ProtocolLogoSize;
}) {
  const logo = LOGOS[protocol];
  const classes = sizeClasses[size];

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden border border-white/10 bg-white/[0.045] shadow-[0_0_18px_-14px_rgba(125,211,252,0.7)] ${classes.box} ${className}`}
      title={logo.alt}
    >
      <img
        alt={logo.alt}
        className={`${classes.image} rounded-full object-contain`}
        decoding="async"
        loading="lazy"
        src={logo.src}
      />
    </span>
  );
}
