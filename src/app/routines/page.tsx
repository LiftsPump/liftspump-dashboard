import Header from "../../components/Header";
import styles from "../page.module.css";
import Navigation from "../../components/Navigation";
import { Box, List, ListItemButton, ListItemIcon, ListItemText } from "@mui/material"
import Divider from '@mui/material/Divider';

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
            display: "flex",
            maxHeight: "100vh",
            overflowY: "auto",
            flexDirection: "row"
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
            <Divider orientation="vertical"/>
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
