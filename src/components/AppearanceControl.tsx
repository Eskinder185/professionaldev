import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemePreference } from "../theme/ThemeProvider";

const OPTIONS: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

/** Light / Dark / System appearance. "System" follows the operating system and updates live. */
export default function AppearanceControl() {
  const { preference, setPreference, theme } = useTheme();
  return (
    <div>
      <div className="cos-segmented" role="radiogroup" aria-label="Appearance">
        {OPTIONS.map(({ value, label, Icon }) => (
          <button key={value} type="button" role="radio" aria-checked={preference === value} onClick={() => setPreference(value)}>
            <Icon size={15} aria-hidden="true" /> {label}
          </button>
        ))}
      </div>
      <p className="cos-muted" style={{ marginTop: 8 }} aria-live="polite">
        {preference === "system" ? `Following your device setting (currently ${theme}).` : `Always ${preference}.`}
      </p>
    </div>
  );
}
