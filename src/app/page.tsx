import Header from "../components/Header";
import Navigation from "../components/Navigation";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <Navigation />
      </main>
      <footer className={styles.footer}>
        
      </footer>
    </div>
  );
}
