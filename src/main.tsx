import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Initialize theme before render to prevent flash
const savedTheme = JSON.parse(localStorage.getItem('fox-portal-theme') || '{}')?.state?.theme || 'dark';
document.documentElement.classList.toggle('dark', savedTheme === 'dark');

createRoot(document.getElementById("root")!).render(<App />);
