import { BarChart, HeatmapChart, LineChart, PieChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useEffect, useRef } from "react";

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  HeatmapChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

type ChartOption = echarts.EChartsCoreOption;

const INK = "#0f172a";
const MUTED = "#64748b";
const LINE = "#e8ebf0";
const ACCENT = "#059669";
const TRACK = "#eef1f4";

// Risk hues shared with the collect list (status colors, always paired with a
// text label so meaning never rides on color alone).
export const RISK_HUE: Record<string, string> = {
  high: "#dc2626",
  medium: "#d97706",
  low: "#059669",
};

// Emerald single-hue ramp, light→dark, for sequential (heatmap) magnitude.
const SEQUENTIAL = ["#eafaf3", "#a7e3c8", "#5ccf9c", "#10b981", "#047857"];

// Responsive by container, not window: a ResizeObserver keeps the chart fitted
// to its parent as the phone rotates or the layout reflows.
export default function EChart({ option, height = 220 }: { option: ChartOption; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chart = echarts.init(el);
    chart.setOption(option);
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el);
    return () => {
      ro.disconnect();
      chart.dispose();
    };
  }, [option]);

  return <div ref={ref} style={{ width: "100%", height }} />;
}

const flatTooltip = {
  confine: true,
  backgroundColor: "#ffffff",
  borderColor: LINE,
  borderWidth: 1,
  textStyle: { color: INK, fontSize: 12 },
  extraCssText: "box-shadow: 0 4px 16px rgba(16,24,40,0.10); border-radius: 4px;",
};

export interface Slice {
  name: string;
  value: number;
  color?: string;
}

// Progress ring — done vs remaining, count in the middle. Used per route.
export function ringOption(value: number, total: number): ChartOption {
  return {
    animation: false,
    title: {
      text: `${value}/${total}`,
      left: "center",
      top: "center",
      textStyle: { color: INK, fontSize: 14, fontWeight: 700 },
    },
    series: [
      {
        type: "pie",
        radius: ["68%", "92%"],
        silent: true,
        label: { show: false },
        data: [
          { value, itemStyle: { color: ACCENT } },
          { value: Math.max(0, total - value), itemStyle: { color: TRACK } },
        ],
      },
    ],
  };
}

// Donut — parts of a whole. Legend sits below so it never crowds a phone width.
export function donutOption(items: Slice[]): ChartOption {
  return {
    animation: false,
    tooltip: { trigger: "item", ...flatTooltip },
    legend: {
      bottom: 0,
      left: "center",
      itemWidth: 10,
      itemHeight: 10,
      icon: "roundRect",
      textStyle: { color: MUTED, fontSize: 12 },
    },
    series: [
      {
        type: "pie",
        radius: ["50%", "74%"],
        center: ["50%", "44%"],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: "#ffffff", borderWidth: 2 },
        label: { show: true, formatter: "{d}%", color: INK, fontSize: 11, fontWeight: 600 },
        labelLine: { length: 6, length2: 5, lineStyle: { color: LINE } },
        data: items.map((s) => ({
          name: s.name,
          value: s.value,
          itemStyle: s.color ? { color: s.color } : undefined,
        })),
      },
    ],
  };
}

// Horizontal bars — ranking of labelled magnitudes (biggest on top).
export function hbarOption(
  categories: string[],
  values: number[],
  colors?: string[],
): ChartOption {
  return {
    animation: false,
    grid: { left: 8, right: 40, top: 6, bottom: 6, containLabel: true },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, ...flatTooltip },
    xAxis: {
      type: "value",
      splitLine: { lineStyle: { color: LINE } },
      axisLabel: { color: MUTED, fontSize: 10 },
    },
    yAxis: {
      type: "category",
      data: categories,
      inverse: true,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: LINE } },
      axisLabel: { color: MUTED, fontSize: 11 },
    },
    series: [
      {
        type: "bar",
        data: values.map((v, i) => ({ value: v, itemStyle: { color: colors?.[i] ?? ACCENT } })),
        barMaxWidth: 18,
        itemStyle: { borderRadius: [0, 4, 4, 0] },
        label: { show: true, position: "right", color: MUTED, fontSize: 10 },
      },
    ],
  };
}

// Heatmap — magnitude across two categorical axes (e.g. site × fill band).
export function heatmapOption(
  xLabels: string[],
  yLabels: string[],
  data: [number, number, number][],
  maxValue: number,
): ChartOption {
  return {
    animation: false,
    grid: { left: 8, right: 8, top: 8, bottom: 48, containLabel: true },
    tooltip: { position: "top", ...flatTooltip },
    xAxis: {
      type: "category",
      data: xLabels,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: MUTED, fontSize: 10, interval: 0, rotate: xLabels.length > 5 ? 30 : 0 },
    },
    yAxis: {
      type: "category",
      data: yLabels,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: MUTED, fontSize: 11 },
    },
    visualMap: {
      min: 0,
      max: Math.max(1, maxValue),
      calculable: false,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      itemWidth: 12,
      itemHeight: 100,
      textStyle: { color: MUTED, fontSize: 10 },
      inRange: { color: SEQUENTIAL },
    },
    series: [
      {
        type: "heatmap",
        data,
        itemStyle: { borderColor: "#ffffff", borderWidth: 2 },
      },
    ],
  };
}
