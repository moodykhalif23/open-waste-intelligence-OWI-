import { HeatmapChart, LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent, VisualMapComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useEffect, useRef } from "react";
import { owi } from "../theme";

echarts.use([LineChart, HeatmapChart, GridComponent, TooltipComponent, VisualMapComponent, CanvasRenderer]);

type ChartOption = echarts.EChartsCoreOption;

const CHART_FONT = '"Inter Variable", system-ui, sans-serif';
const DAY_MS = 24 * 60 * 60 * 1000;

export const SERIES = [
  owi.ink,
  "#e0a526",
  owi.ok,
  "#2a78d6",
  "#7c5cc4",
  "#1f9aa8",
  owi.faint,
] as const;

const HEAT = [owi.wash, owi.goldTint, "#f5cd78", owi.gold, "#c98d16", owi.brown];

export default function EChart({ option, height = 280 }: { option: ChartOption; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chart = echarts.init(el);
    chart.setOption({ textStyle: { fontFamily: CHART_FONT }, ...option });
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(el);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [option]);

  return <div ref={ref} style={{ height }} />;
}

const tooltipStyle = {
  backgroundColor: "#ffffff",
  borderColor: owi.line,
  borderWidth: 1,
  padding: [8, 12],
  textStyle: { color: owi.ink, fontSize: 12, fontFamily: CHART_FONT },
  extraCssText: "box-shadow: 0 8px 24px rgba(16,24,40,0.10); border-radius: 10px;",
};

const tipHtml = (label: string, value: string) =>
  `<div style="color:${owi.muted};font-size:11px;margin-bottom:2px">${label}</div>` +
  `<div style="font-weight:700;font-size:14px;color:${owi.ink}">${value}</div>`;

export const compact = (v: number) =>
  Math.abs(v) >= 1_000_000
    ? `${+(v / 1_000_000).toFixed(1)}M`
    : Math.abs(v) >= 1000
      ? `${+(v / 1000).toFixed(1)}k`
      : `${+v.toFixed(1)}`;

function sparseLabels(n: number, target = 5) {
  const step = Math.max(1, Math.ceil((n - 1) / (target - 1)));
  return (index: number) =>
    index === n - 1 || (index % step === 0 && n - 1 - index >= step / 2);
}

export function areaOption(
  categories: string[],
  values: number[],
  format: (v: number) => string = (v) => v.toLocaleString(),
): ChartOption {
  return {
    animation: false,
    grid: { left: 2, right: 10, top: 12, bottom: 2, containLabel: true },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "line", lineStyle: { color: owi.stroke, type: "dashed" } },
      ...tooltipStyle,
      formatter: (params: { axisValueLabel: string; value: number }[]) => {
        const p = params[0];
        return p ? tipHtml(p.axisValueLabel, format(p.value)) : "";
      },
    },
    xAxis: {
      type: "category",
      data: categories,
      boundaryGap: false,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: owi.muted,
        fontSize: 11,
        margin: 12,
        interval: sparseLabels(categories.length),
      },
    },
    yAxis: {
      type: "value",
      splitNumber: 3,
      minInterval: 1,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: owi.faint, fontSize: 11, formatter: compact },
      splitLine: { lineStyle: { color: owi.rule } },
    },
    series: [
      {
        type: "line",
        data: values,
        showSymbol: values.length <= 2,
        symbol: "circle",
        symbolSize: 7,
        lineStyle: { color: owi.ink, width: 2.25, join: "round" },
        itemStyle: { color: owi.ink, borderColor: "#ffffff", borderWidth: 2 },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(242,185,73,0.34)" },
              { offset: 1, color: "rgba(242,185,73,0)" },
            ],
          },
        },
      },
    ],
  };
}

export function heatmapOption(
  xLabels: string[],
  yLabels: string[],
  data: [number, number, number][],
  maxValue: number,
): ChartOption {
  return {
    animation: false,
    grid: { left: 2, right: 2, top: 2, bottom: 2, containLabel: true },
    tooltip: {
      ...tooltipStyle,
      formatter: (p: { value: [number, number, number] }) =>
        tipHtml(`${yLabels[p.value[1]] ?? ""} · ${xLabels[p.value[0]] ?? ""}:00`, p.value[2].toLocaleString()),
    },
    xAxis: {
      type: "category",
      data: xLabels,
      splitArea: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: owi.faint, fontSize: 10, interval: 5, margin: 8 },
    },
    yAxis: {
      type: "category",
      data: yLabels,
      inverse: true,
      splitArea: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: owi.muted, fontSize: 11, margin: 10 },
    },
    visualMap: {
      show: false,
      min: 0,
      max: Math.max(1, maxValue),
      inRange: { color: HEAT },
    },
    series: [
      {
        type: "heatmap",
        data,
        itemStyle: { borderColor: "#ffffff", borderWidth: 2, borderRadius: 3 },
        emphasis: { itemStyle: { borderColor: owi.ink, borderWidth: 1 } },
      },
    ],
  };
}

export const intlLocale = (lang: string) => (lang === "sw" ? "sw-KE" : "en-GB");

export function startOfDay(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function bucketSeries(
  stamps: Iterable<string | number>,
  days: number,
  locale: string,
  now = Date.now(),
): { labels: string[]; values: number[]; weekly: boolean } {
  const weekly = days > 60;
  const size = weekly ? 7 * DAY_MS : DAY_MS;
  const count = weekly ? Math.ceil(days / 7) : days;
  const end = startOfDay(now) + DAY_MS;
  const first = end - count * size;
  const fmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const labels = Array.from({ length: count }, (_, i) => fmt.format(new Date(first + i * size)));
  const values = new Array<number>(count).fill(0);
  for (const s of stamps) {
    const t = typeof s === "number" ? s : Date.parse(s);
    if (t < first || t >= end) continue;
    const i = Math.floor((t - first) / size);
    values[i] = (values[i] ?? 0) + 1;
  }
  return { labels, values, weekly };
}
