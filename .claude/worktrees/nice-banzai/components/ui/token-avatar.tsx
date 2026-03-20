import { getTokenColor } from "@/lib/utils";

interface TokenAvatarProps {
  symbol?: string;
  size?: number;
}

export function TokenAvatar({ symbol, size = 28 }: TokenAvatarProps) {
  const color = getTokenColor(symbol);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        background: `${color}18`,
        border: `1.5px solid ${color}30`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.36,
        fontWeight: 700,
        color,
      }}
    >
      {symbol?.slice(0, 2) ?? "?"}
    </div>
  );
}
