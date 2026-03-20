interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  bg?: string;
}

export function Badge({ children, color = "#4F6EF7", bg }: BadgeProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 7px",
        borderRadius: "5px",
        fontSize: "10px",
        fontWeight: 600,
        letterSpacing: "0.3px",
        color,
        background: bg ?? `${color}14`,
      }}
    >
      {children}
    </span>
  );
}

export function TypeBadge({ type }: { type: "v2" | "v3" }) {
  return type === "v3" ? (
    <Badge color="#7C3AED" bg="#F5F3FF">V3</Badge>
  ) : (
    <Badge color="#D97706" bg="#FFFBEB">V2</Badge>
  );
}

export function RangeBadge({ inRange }: { inRange: boolean }) {
  return inRange ? (
    <Badge color="#059669" bg="#ECFDF5">● In Range</Badge>
  ) : (
    <Badge color="#DC2626" bg="#FEF2F2">● Out of Range</Badge>
  );
}
