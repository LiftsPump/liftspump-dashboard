import Header from "../../components/Header";
import styles from "../page.module.css";

export default function Payments() {
  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <div className={styles.pageContent}>
          <h1>Payments</h1>
          <p>Manage payment transactions and billing here.</p>
          {/* Add your payments content here */}
        </div>
      </main>
      <footer className={styles.footer}>
        
      </footer>
    </div>
  );
}
