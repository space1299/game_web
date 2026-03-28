import { Footer } from "./Footer";
import { Header } from "./Header";

export function AppShell({ children }) {
  return (
    <div className="shell">
      <Header />
      <main className="shell__main">
        <div className="shell__inner">{children}</div>
      </main>
      <Footer />
    </div>
  );
}
