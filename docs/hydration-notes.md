# Hydration Notes

Browser security and wallet extensions may inject attributes such as `bis_skin_checked`
onto the root document before React hydrates. Agent BlackBox scopes hydration-warning
suppression to the root layout for that external mutation only.

Application-owned UI should still hydrate deterministically. Wallet-rendered account
state stays hidden until client mount, and wallet menus are portaled only after mount.
