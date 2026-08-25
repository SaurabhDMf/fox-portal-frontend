import { createRoot } from "react-dom/client";
import DesktopApp from "./DesktopApp";
import "../index.css";

// Initialize theme before render to prevent flash (same key as the web app)
const savedTheme = JSON.parse(localStorage.getItem('fox-portal-theme') || '{}')?.state?.theme || 'dark';
document.documentElement.classList.toggle('dark', savedTheme === 'dark');

createRoot(document.getElementById("root")!).render(<DesktopApp />);
