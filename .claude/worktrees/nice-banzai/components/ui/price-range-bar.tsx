interface PriceRangeBarProps {
  priceLower:   number;
  priceUpper:   number;
  currentPrice: number;
  inRange:      boolean;
}

export function PriceRangeBar({
  priceLower,
  priceUpper,
  currentPrice,
  inRange,
}: PriceRangeBarProps) {
  const range  = priceUpper - priceLower;
  const pct    = range > 0
    ? Math.min(Math.max(((currentPrice - priceLower) / range) * 100, 2), 98)
    : 50;
  const color  = inRange ? "#059669" : "#DC2626";
  const trackBg = inRange ? "#ECFDF5" : "#FEF2F2";

  return (
    <div>
      <div className="flex justify-between text-[10px] text-gray-400 mb-1">
        <span>${priceLower.toFixed(4)}</span>
        <span style={{ color, fontWeight: 600 }}>● {currentPrice.toFixed(4)}</span>
        <span>${priceUpper.toFixed(4)}</span>
      </div>
      <div className="relative h-[5px] rounded-full" style={{ background: "#E8EAED" }}>
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: trackBg }}
        />
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
          style={{
            left:      `${pct}%`,
            width:     11,
            height:    11,
            background: color,
            boxShadow: `0 0 0 2px ${color}30`,
          }}
        />
      </div>
    </div>
  );
}
