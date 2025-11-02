"use client";
import Link from "next/link";
import { Box, Button, Stack, Typography } from "@mui/material";
import Header from "../components/Header";
import Navigation from "../components/Navigation";
import styles from "./page.module.css";

export default function NotFound() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <Box
          sx={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            p: 2,
          }}
        >
          <Stack spacing={2} alignItems="center" textAlign="center">
            <Typography variant="h3" fontWeight={700} color="white">
              404
            </Typography>
            <Typography variant="h5" color="white">
              We can’t find that page.
            </Typography>
          </Stack>
        </Box>
      </main>
      <footer className={styles.footer}></footer>
    </div>
  );
}
