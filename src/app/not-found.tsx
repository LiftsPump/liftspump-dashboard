"use client";
import Link from "next/link";
import { Box, Button, Stack, Typography } from "@mui/material";
import Header from "../components/Header";
import Navigation from "../components/Navigation";
import styles from "./page.module.css";

export default function NotFound() {
  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <Navigation />
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
            <Typography variant="body1" sx={{ opacity: 0.75 }}>
              Double-check the URL or head back to your dashboard to continue.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button component={Link} href="/" variant="contained" color="primary">
                Go Home
              </Button>
              <Button component={Link} href="/join" variant="outlined" color="inherit">
                Visit Join Page
              </Button>
            </Stack>
          </Stack>
        </Box>
      </main>
      <footer className={styles.footer}></footer>
    </div>
  );
}
