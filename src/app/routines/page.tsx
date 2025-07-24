import Header from "../../components/Header";
import styles from "../page.module.css";

export default function Routines() {
  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <div className={styles.pageContent}>
          <h1>Routines</h1>
          <p>Manage your workout routines here.</p>
          {/* Add your routines content here */}
        </div>
      </main>
      <footer className={styles.footer}>
        
      </footer>
    </div>
  );
}
