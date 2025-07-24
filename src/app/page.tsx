import Header from "../components/Header";
import Navigation from "../components/Navigation";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <div className={styles.welcomeSection}>
          <h1>Welcome to LiftsPump Dashboard</h1>
          <p>Select a section to manage your fitness platform:</p>
        </div>
        <Navigation />
      </main>
      <footer className={styles.footer}>
        
      </footer>
    </div>
  );
}
