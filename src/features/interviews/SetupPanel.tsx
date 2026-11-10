import { useEffect, useId, useState } from "react";
import { Camera, Keyboard, Mic, Play, ShieldCheck } from "lucide-react";
import { MODE_LABELS, TYPE_LABELS, type Difficulty, type InterviewConfig, type InterviewType, type Level, type PracticeMode } from "./model";
import type { TranscriptionSupport } from "./speech";

type Props = {
  config: InterviewConfig;
  onChange: (config: InterviewConfig) => void;
  onStart: () => void;
  transcription: TranscriptionSupport | null;
};

const MODE_ICONS = { text: Keyboard, voice: Mic, camera: Camera };

function useDevices() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const load = () => navigator.mediaDevices.enumerateDevices().then(setDevices).catch(() => setDevices([]));
    load();
    navigator.mediaDevices.addEventListener?.("devicechange", load);
    return () => navigator.mediaDevices.removeEventListener?.("devicechange", load);
  }, []);
  return devices;
}

export default function SetupPanel({ config, onChange, onStart, transcription }: Props) {
  const id = useId();
  const devices = useDevices();
  const set = <K extends keyof InterviewConfig>(key: K, value: InterviewConfig[K]) => onChange({ ...config, [key]: value });
  const consent = <K extends keyof InterviewConfig["consents"]>(key: K, value: InterviewConfig["consents"][K]) => onChange({ ...config, consents: { ...config.consents, [key]: value } });
  const mics = devices.filter((device) => device.kind === "audioinput");
  const cameras = devices.filter((device) => device.kind === "videoinput");
  const usesMic = config.mode !== "text";
  const cloudOnly = transcription?.kind === "cloud";
  const jdMissing = config.type === "job" && !config.jobDescription.trim();

  return (
    <div className="iv-setup">
      <section className="career-panel iv-card" aria-labelledby={`${id}-mode`}>
        <h2 id={`${id}-mode`}>Practice mode</h2>
        <div className="iv-modes" role="radiogroup" aria-label="Practice mode">
          {(Object.keys(MODE_LABELS) as PracticeMode[]).map((mode) => {
            const Icon = MODE_ICONS[mode];
            return (
              <button key={mode} type="button" role="radio" aria-checked={config.mode === mode} className={config.mode === mode ? "selected" : ""} onClick={() => set("mode", mode)}>
                <Icon size={18} aria-hidden="true" />
                <strong>{MODE_LABELS[mode]}</strong>
                <span>{mode === "text" ? "Type your answers. No devices used." : mode === "voice" ? "Answer aloud. Microphone only." : "Answer aloud with your camera on. Camera is optional and off until you turn it on."}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="career-panel iv-card" aria-labelledby={`${id}-config`}>
        <h2 id={`${id}-config`}>Interview</h2>
        <div className="iv-grid">
          <div className="rs-field">
            <label htmlFor={`${id}-title`}>Target job title</label>
            <input id={`${id}-title`} value={config.jobTitle} onChange={(event) => set("jobTitle", event.target.value)} placeholder="e.g. IT Support Specialist" />
          </div>
          <div className="rs-field">
            <label htmlFor={`${id}-type`}>Interview type</label>
            <select id={`${id}-type`} value={config.type} onChange={(event) => set("type", event.target.value as InterviewType)}>
              {(Object.keys(TYPE_LABELS) as InterviewType[]).map((type) => (
                <option key={type} value={type}>{TYPE_LABELS[type]}</option>
              ))}
            </select>
          </div>
          <div className="rs-field">
            <label htmlFor={`${id}-level`}>Experience level</label>
            <select id={`${id}-level`} value={config.level} onChange={(event) => set("level", event.target.value as Level)}>
              <option value="entry">Entry level</option>
              <option value="mid">Mid level</option>
              <option value="senior">Senior</option>
            </select>
          </div>
          <div className="rs-field">
            <label htmlFor={`${id}-difficulty`}>Difficulty</label>
            <select id={`${id}-difficulty`} value={config.difficulty} onChange={(event) => set("difficulty", event.target.value as Difficulty)}>
              <option value="intro">Introductory</option>
              <option value="standard">Standard</option>
              <option value="challenging">Challenging</option>
            </select>
          </div>
          <div className="rs-field">
            <label htmlFor={`${id}-count`}>Session length</label>
            <select id={`${id}-count`} value={config.questionCount} onChange={(event) => set("questionCount", Number(event.target.value))}>
              {[1, 3, 5, 8].map((count) => (
                <option key={count} value={count}>{count} question{count === 1 ? "" : "s"}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="rs-field">
          <label htmlFor={`${id}-jd`}>Job description {config.type === "job" ? "(required for this type)" : "(optional)"}</label>
          <textarea id={`${id}-jd`} rows={4} value={config.jobDescription} onChange={(event) => set("jobDescription", event.target.value)} placeholder="Paste a posting to get questions about its requirements and see which ones your answers mention." />
        </div>
      </section>

      {usesMic ? (
        <section className="career-panel iv-card" aria-labelledby={`${id}-devices`}>
          <h2 id={`${id}-devices`}>Devices and transcription</h2>
          <div className="iv-grid">
            <div className="rs-field">
              <label htmlFor={`${id}-mic`}>Microphone</label>
              <select id={`${id}-mic`} value={config.micId} onChange={(event) => set("micId", event.target.value)}>
                <option value="">System default</option>
                {mics.filter((device) => device.deviceId && device.deviceId !== "default").map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${index + 1}`}</option>
                ))}
              </select>
            </div>
            {config.mode === "camera" ? (
              <div className="rs-field">
                <label htmlFor={`${id}-camera`}>Camera</label>
                <select id={`${id}-camera`} value={config.cameraId} onChange={(event) => set("cameraId", event.target.value)}>
                  <option value="">System default</option>
                  {cameras.filter((device) => device.deviceId).map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="rs-field">
              <label htmlFor={`${id}-stt`}>Transcription</label>
              <select id={`${id}-stt`} value={config.transcription} onChange={(event) => set("transcription", event.target.value as InterviewConfig["transcription"])}>
                <option value="browser">Live, using this browser's speech recognition</option>
                <option value="off">Off: I'll type or paste the transcript</option>
              </select>
            </div>
          </div>
          <p className="career-muted">Device names appear after you first allow access. Nothing is turned on until you press Start answer or Turn camera on.</p>
          <p className={`iv-support iv-support-${transcription?.kind ?? "checking"}`} role="note">
            {transcription ? transcription.detail : "Checking live transcription support…"}
          </p>
        </section>
      ) : null}

      <section className="career-panel iv-card" aria-labelledby={`${id}-privacy`}>
        <h2 id={`${id}-privacy`}><ShieldCheck size={17} aria-hidden="true" /> Privacy and consent</h2>
        <ul className="iv-consents">
          <li>
            <strong>Microphone and camera</strong>
            <span>Your browser asks for permission the first time each is used. Indicators show whenever they are on.</span>
          </li>
          <li>
            <label className="rs-check">
              <input type="checkbox" checked={config.consents.saveRecordings} disabled={!usesMic} onChange={(event) => consent("saveRecordings", event.target.checked)} />
              Save recordings on this device for replay
            </label>
            <span>Off by default. Stored only in this browser and deleted automatically after</span>
            <select aria-label="Keep recordings for" value={config.consents.retentionDays} disabled={!config.consents.saveRecordings} onChange={(event) => consent("retentionDays", Number(event.target.value))}>
              {[1, 7, 30].map((days) => (
                <option key={days} value={days}>{days} day{days === 1 ? "" : "s"}</option>
              ))}
            </select>
          </li>
          <li>
            <label className="rs-check">
              <input type="checkbox" checked={config.consents.cloudTranscription} disabled={!usesMic || !cloudOnly} onChange={(event) => consent("cloudTranscription", event.target.checked)} />
              Allow the browser's speech service for live transcription
            </label>
            <span>{cloudOnly ? "Required in this browser: audio is sent to the browser vendor's speech service while you answer." : transcription?.kind === "on-device" ? "Not needed: transcription runs on this device." : "Not applicable in this browser."}</span>
          </li>
          <li>
            <label className="rs-check">
              <input type="checkbox" checked={config.consents.cameraAnalysis} disabled={config.mode !== "camera"} onChange={(event) => consent("cameraAnalysis", event.target.checked)} />
              Camera presentation feedback (on-device)
            </label>
            <span>Estimates framing and approximate head direction locally. Video is never uploaded. You can switch it off during the session.</span>
          </li>
          <li>
            <strong>Cloud AI analysis</strong>
            <span>Not available: no AI service is configured. All feedback is rule-based and computed in this browser.</span>
          </li>
        </ul>
      </section>

      <div className="iv-start">
        {jdMissing ? <p className="rs-notice" role="note">Paste a job description to generate job-specific questions, or choose another interview type.</p> : null}
        <button type="button" className="career-quick-create iv-start-button" disabled={jdMissing} onClick={onStart}>
          <Play size={16} /> Start practice session
        </button>
      </div>
    </div>
  );
}
