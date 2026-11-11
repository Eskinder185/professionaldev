import { createRoot } from "react-dom/client";
import AISettingsPanel from "../sidepanel/AISettingsPanel";

const target = document.getElementById("opt-ai-settings");
if (target) createRoot(target).render(<AISettingsPanel />);
