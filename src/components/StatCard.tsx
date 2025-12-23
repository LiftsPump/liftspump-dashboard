import { Box, Paper, Stack, Typography } from "@mui/material";
import React from "react";

type StatCardProps = {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: string;
  linkLocation: string;
  linkText: string;
  accent?: string;
};

export default function StatCard({
  icon,
  label,
  value,
  sub,
  linkLocation,
  linkText,
  accent = "#1AE080",
}: StatCardProps) {
  return (
    <Paper
      onClick={() => location.assign(linkLocation)}
      sx={{
        p: 2,
        border: "1px solid",
        borderColor: "#2a2a2a",
        bgcolor: "#1a1a1a",
        minWidth: 220,
        position: "relative",
        overflow: "hidden",
        color: "#fff",
        cursor: "pointer",
        transition: "all 180ms ease",
        "&:hover": {
          transform: "translateY(-2px) scale(1.01)",
          boxShadow: `0 10px 30px -12px ${accent}55`,
          borderColor: `${accent}66`,
        },
        "&:active": {
          transform: "translateY(0px) scale(0.99)",
        },
        "&:hover .statcard-icon": {
          transform: "scale(1.05)",
        },
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          opacity: 0.12,
          background: `radial-gradient(600px 120px at -10% -10%, ${accent}, transparent)`,
        }}
      />
      <Stack direction="column" spacing={1} alignItems="flex-start">
        <Box
          className="statcard-icon"
          sx={{
            width: 36,
            height: 36,
            flex: "0 0 36px",
            aspectRatio: "1 / 1",
            borderRadius: "50%",
            bgcolor: accent,
            color: "#0b0b0b",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            boxShadow: "0 0 0 2px rgba(255,255,255,0.06) inset",
            "& svg": { width: 20, height: 20 },
            transition: "transform 180ms ease",
          }}
        >
          {icon}
        </Box>
        <Box>
          <Typography variant="overline" sx={{ letterSpacing: 1, color: "#e5e7eb" }}>
            {label}
          </Typography>
          <Typography variant="h4" fontWeight={700} color="white">
            {value}
          </Typography>
          {sub && (
            <>
              <Typography variant="body2" sx={{ opacity: 0.7, color: "#d1d5db" }}>
                {sub}
              </Typography>
              <Box
                sx={{
                  mt: 0.5,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.75,
                  px: 1.25,
                  py: 0.5,
                  borderRadius: 1,
                  bgcolor: `${accent}1A`,
                  color: accent,
                  fontSize: 13,
                  fontWeight: 500,
                  pointerEvents: "none",
                  border: `1px solid ${accent}33`,
                  transition: "all 150ms ease",
                  "&:hover": {
                    bgcolor: `${accent}33`,
                  },
                  "&:active": {
                    transform: "scale(0.98)",
                  },
                  "&:hover .statcard-arrow": {
                    transform: "translateX(4px)",
                  },
                }}
              >
                <span>{linkText}</span>
                <span
                  style={{
                    display: "inline-block",
                    transition: "transform 150ms ease",
                  }}
                  className="statcard-arrow"
                >
                  →
                </span>
              </Box>
            </>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}
