import { Paper, Stack, Typography } from "@mui/material";
import GaugeRing, { GaugeRingItem } from "./Gauge";

export type QuickOverviewMetric = GaugeRingItem;

type QuickOverviewRingsProps = {
  metrics: QuickOverviewMetric[];
};

export default function QuickOverviewRings({ metrics }: QuickOverviewRingsProps) {
  return (
    <Paper
      sx={{
        p: 2,
        border: "1px solid",
        borderColor: "#2a2a2a",
        bgcolor: "#1a1a1a",
        color: "white",
        height: "100%",
      }}
    >
      <GaugeRing rings={metrics} />
    </Paper>
  );
}
