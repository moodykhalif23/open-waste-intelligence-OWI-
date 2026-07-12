import { BarChart, type BarSeriesOption } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  type GridComponentOption,
  type TooltipComponentOption,
} from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useEffect, useRef } from "react";

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

type ChartOption = echarts.ComposeOption<
  BarSeriesOption | GridComponentOption | TooltipComponentOption
>;

export const INK = "#111827";
export const MUTED = "#6b7280";
export const LINE = "#e5e7eb";
export const ACCENT = "#15803d";

export default function EChart({ option, height = 280 }: { option: ChartOption; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chart = echarts.init(el);
    chart.setOption(option);
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
  }, [option]);

  return <div ref={ref} style={{ height }} />;
}

const flatTooltip = {
  backgroundColor: "#ffffff",
  borderColor: LINE,
  borderWidth: 1,
  textStyle: { color: INK, fontSize: 12 },
  extraCssText: "box-shadow: none; border-radius: 8px;",
};

export function barOption(categories: string[], values: number[]): ChartOption {
  return {
    animation: false,
    grid: { left: 40, right: 8, top: 16, bottom: 28 },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, ...flatTooltip },
    xAxis: {
      type: "category",
      data: categories,
      axisLine: { lineStyle: { color: LINE } },
      axisTick: { show: false },
      axisLabel: { color: MUTED, fontSize: 11 },
    },
    yAxis: {
      type: "value",
      minInterval: 1,
      splitLine: { lineStyle: { color: LINE } },
      axisLabel: { color: MUTED, fontSize: 11 },
    },
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
