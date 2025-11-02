"use client";
import Header from "../../components/Header";
import Navigation from "../../components/Navigation";
import styles from "../page.module.css";
import { Box, Paper, Stack, Typography, Button } from "@mui/material";
import useDocumentTitle from "../../hooks/useDocumentTitle";

/**
 * Copy this page into a new directory under `src/app/<your-route>/page.tsx`
 * and update the content as needed.
 */
export default function PageTemplate() {
  useDocumentTitle("Template | Liftspump");

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <Navigation />
        <div className={styles.pageContent}>
          <Stack spacing={2}>
            <Typography variant="h5" fontWeight={700}>
              Page Title
            </Typography>
            <Typography variant="body1" sx={{ maxWidth: 520 }}>
              Replace this text with the content for your new page. You can copy this template into a
              new folder inside <code>src/app</code> to quickly scaffold pages that match the rest
              of the dashboard.
            </Typography>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                Example section
              </Typography>
              <Typography variant="body2" sx={{ mb: 1, opacity: 0.8 }}>
                Drop in whatever components you need inside this container.
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button variant="contained" size="small">
                  Primary action
                </Button>
                <Button variant="outlined" size="small">
                  Secondary action
                </Button>
              </Stack>
            </Paper>
            <Box>
              <Typography variant="subtitle2" sx={{ opacity: 0.7 }}>
                Tips
              </Typography>
              <Typography variant="body2">
                - Update <code>useDocumentTitle</code> to match your page title.
                <br />
                - Keep layout structure: wrap content in <code>styles.pageContent</code>.
                <br />
                - Use MUI components (`Paper`, `Stack`, etc.) for consistent styling.
              </Typography>
            </Box>
          </Stack>
        </div>
      </main>
      <footer className={styles.footer}></footer>
    </div>
  );
}

