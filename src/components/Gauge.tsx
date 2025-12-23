import ReactECharts from "echarts-for-react";

export type GaugeRingItem = {
  label: string;
  value: number;
  displayValue?: string;
  color?: string;
  width: number;
};

type GaugeRingProps = {
  rings: GaugeRingItem[];
  max?: number;
  height?: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function GaugeRing({ rings, max = 100 }: GaugeRingProps) {
  const normalized = rings.map((ring) => {
    const safeValue = Number.isFinite(ring.value) ? ring.value : 0;
    return {
      ...ring,
      clampedValue: clamp(safeValue, 0, max),
      valueLabel: ring.displayValue ?? `${Math.round(safeValue)}%`,
      color: ring.color ?? "#1AE080",
    };
  });

  const ringSpacing = 10;
  const labelBlockSpacing = 36;
  const labelBase = -((normalized.length - 1) * labelBlockSpacing) / 2;

  const option = {
    backgroundColor: "transparent",
    graphic: {
      type: "group",
      left: "center",
      top: "center",
      children: normalized.map((ring, index) => ({
        type: "text",
        position: [0, labelBase + index * labelBlockSpacing],
        style: {
          text: `${ring.label}\n${ring.valueLabel}`,
          fill: "#e5e7eb",
          fontSize: 12,
          fontWeight: 600,
          align: "center",
          verticalAlign: "middle",
          lineHeight: 14,
        },
      })),
    },
    series: normalized.map((ring, index) => {
      const radius = (90+((ring.width-10)/2)) - index * 10;
      return {
        type: "gauge",
        startAngle: 90,
        endAngle: -270,
        radius: `${radius}%`,
        min: 0,
        max,
        progress: {
          show: true,
          width: ring.width,
          roundCap: true,
          itemStyle: { color: ring.color },
        },
        axisLine: {
          lineStyle: {
            width: ring.width,
            color: [[1, "rgba(255,255,255,0.08)"]],
          },
        },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        pointer: { show: false },
        title: { show: false },
        detail: { show: false },
        data: [{ value: ring.clampedValue, name: ring.label }],
      };
    }),
  };

  return <ReactECharts option={option} style={{ height: "100%", width: "100%" }} opts={{ renderer: "svg" }} />;
}
