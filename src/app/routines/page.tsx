import Header from "../../components/Header";
import styles from "../page.module.css";
import Navigation from "../../components/Navigation";
import { Box, List, ListItemButton, ListItemIcon, ListItemText } from "@mui/material"

enum RoutineItem {
  Cardio = "Cardio",
  Strength = "Strength",
  Flexibility = "Flexibility"
}

export default function Routines() {
  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <Navigation/>
        <div className={styles.pageContent}>
          <h1>Routines</h1>
          <Box
          sx={{
            maxHeight: "100vh",
            overflowY: "auto"
          }}>
            <List>
              {Object.values(RoutineItem).map((item) => (
                <ListItemButton key={item}>
                  <ListItemIcon>
                    {/*<img src={`/icons/${item.toLowerCase()}.png`} alt={item} width={24} height={24} />*/}
                  </ListItemIcon>
                  <ListItemText primary={item} />
                </ListItemButton>
              ))}
            </List>
          </Box>
        </div>
      </main>
      <footer className={styles.footer}>
        
      </footer>
    </div>
  );
}
