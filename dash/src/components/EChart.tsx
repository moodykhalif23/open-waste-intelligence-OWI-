import { BarChart, HeatmapChart, LineChart, PieChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
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
  VisualMapComponent,
  CanvasRenderer,
]);

type ChartOption = echarts.EChartsCoreOption;

export const INK = "#201a10";
export const MUTED = "#6b6456";
export const LINE = "#eae6dd";
export const ACCENT = "#101828";

// Validated categorical palette (dataviz skill, light surface: worst adjacent
// CVD ΔE 24.2). Contrast WARN on aqua/yellow/magenta is relieved by the direct
// labels on donuts and the accompanying data tables on every page that uses it.
export const CATEGORICAL = [
  "#2a78d6",
  "#1baf7a",
  "#eda100",
  "#008300",
  "#4a3aa7",
  "#e34948",
  "#e87ba4",
  "#eb6834",
] as const;

// Stable color per waste material so a material reads the same hue on every
// chart (color follows the entity, never its rank).
export const MATERIAL_COLORS: Record<string, string> = {
  plastic: CATEGORICAL[0],
  glass: CATEGORICAL[1],
  metal: CATEGORICAL[2],
  paper: CATEGORICAL[3],
  organic: CATEGORICAL[4],
  e_waste: CATEGORICAL[5],
  textile: CATEGORICAL[6],
  other_mixed: CATEGORICAL[7],
};

// Ink single-hue ramp, light→dark, for sequential (heatmap) magnitude.
const SEQUENTIAL = ["#eceef1", "#c2c7d0", "#8a93a8", "#3a4256", "#05070c"];

const CHART_FONT = '"Inter Variable", system-ui, sans-serif';

export default function EChart({ option, height = 280 }: { option: ChartOption; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chart = echarts.init(el);
    chart.setOption({ textStyle: { fontFamily: CHART_FONT }, ...option });
    // Container-based: charts reflow when the drawer toggles or the grid
    // re-breaks, not only on window resize.
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(el);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [option]);

  return <div ref={ref} style={{ height }} />;
}

const flatTooltip = {
  backgroundColor: "#ffffff",
  borderColor: LINE,
  borderWidth: 1,
  textStyle: { color: INK, fontSize: 12, fontFamily: CHART_FONT },
  extraCssText: "box-shadow: 0 4px 16px rgba(16,24,40,0.10); border-radius: 4px;",
};

const catAxis = {
  type: "category" as const,
  axisLine: { lineStyle: { color: LINE } },
  axisTick: { show: false },
  axisLabel: { color: MUTED, fontSize: 11 },
};

const valAxis = {
  type: "value" as const,
  splitLine: { lineStyle: { color: LINE } },
  axisLabel: { color: MUTED, fontSize: 11 },
};

// Vertical bars — magnitude across a handful of ordered categories.
export function barOption(categories: string[], values: number[]): ChartOption {
  return {
    animation: false,
    grid: { left: 40, right: 10, top: 16, bottom: 28 },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, ...flatTooltip },
    xAxis: { ...catAxis, data: categories },
    yAxis: { ...valAxis, minInterval: 1 },
    series: [
      {
        type: "bar",
        data: values,
        barMaxWidth: 28,
        itemStyle: { color: ACCENT, borderRadius: [4, 4, 0, 0] },
      },
    ],
  };
}

// Horizontal bars — ranking of labelled magnitudes (biggest on top).
export function hbarOption(
  categories: string[],
  values: number[],
  color = ACCENT,
): ChartOption {
  return {
    animation: false,
    grid: { left: 8, right: 44, top: 8, bottom: 8, containLabel: true },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, ...flatTooltip },
    xAxis: { ...valAxis },
    yAxis: { ...catAxis, data: categories, inverse: true },
    series: [
      {
        type: "bar",
        data: values,
        barMaxWidth: 20,
        itemStyle: { color, borderRadius: [0, 4, 4, 0] },
        label: { show: true, position: "right", color: MUTED, fontSize: 11 },
      },
    ],
  };
}

// Area line — a value changing over time.
export function lineOption(categories: string[], values: number[]): ChartOption {
  return {
    animation: false,
    grid: { left: 40, right: 12, top: 16, bottom: 28 },
    tooltip: { trigger: "axis", axisPointer: { type: "line", lineStyle: { color: LINE } }, ...flatTooltip },
    xAxis: { ...catAxis, boundaryGap: false, data: categories },
    yAxis: { ...valAxis, minInterval: 1 },
    series: [
      {
        type: "line",
        data: values,
        smooth: 0.25,
        showSymbol: false,
        lineStyle: { color: ACCENT, width: 2 },
        areaStyle: { color: "rgba(16,24,40,0.10)" },
      },
    ],
  };
}

export interface Slice {
  name: string;
  value: number;
  color?: string;
}

// Donut — parts of a whole. Direct % labels satisfy the relief rule, so the
// low-contrast categorical hues are always identified by text, not color alone.
export function donutOption(items: Slice[]): ChartOption {
  return {
    animation: false,
    tooltip: { trigger: "item", ...flatTooltip },
    legend: {
      type: "scroll",
      orient: "vertical",
      right: 8,
      top: "middle",
      itemWidth: 10,
      itemHeight: 10,
      icon: "roundRect",
      textStyle: { color: MUTED, fontSize: 12 },
    },
    series: [
      {
        type: "pie",
        radius: ["52%", "76%"],
        center: ["36%", "50%"],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: "#ffffff", borderWidth: 2 },
        label: { show: true, formatter: "{d}%", color: INK, fontSize: 11, fontWeight: 600 },
        labelLine: { length: 8, length2: 6, lineStyle: { color: LINE } },
        data: items.map((s, i) => ({
          name: s.name,
          value: s.value,
          itemStyle: { color: s.color ?? CATEGORICAL[i % CATEGORICAL.length] },
        })),
      },
    ],
  };
}

// Heatmap — magnitude across two categorical axes (e.g. weekday × hour).
export function heatmapOption(
  xLabels: string[],
  yLabels: string[],
  data: [number, number, number][],
  maxValue: number,
): ChartOption {
  return {
    animation: false,
    grid: { left: 8, right: 8, top: 8, bottom: 44, containLabel: true },
    tooltip: { position: "top", ...flatTooltip },
    xAxis: {
      type: "category",
      data: xLabels,
      splitArea: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: MUTED, fontSize: 10, interval: 1 },
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
      itemHeight: 120,
      textStyle: { color: MUTED, fontSize: 10 },
      inRange: { color: SEQUENTIAL },
    },
    series: [
      {
        type: "heatmap",
        data,
        itemStyle: { borderColor: "#ffffff", borderWidth: 2 },
        emphasis: { itemStyle: { borderColor: INK, borderWidth: 1 } },
      },
    ],
  };
}
