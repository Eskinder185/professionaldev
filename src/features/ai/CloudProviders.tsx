import { ArrowLeft, Cloud, Cpu, ShieldAlert } from "lucide-react";
import { plainProviderName } from "./connectionView";
import { PROVIDERS, type ProviderId } from "./providers";
import { evaluateCloudCredentialStatus } from "./taskModels";

/** The cloud services CareerOS knows how to talk to, in the order shown. */
export const CLOUD_PROVIDERS: ProviderId[] = ["openai", "gemini", "anthropic", "custom_cloud"];

const DESCRIPTIONS: Record<string, string> = {
  openai: "ChatGPT’s maker. Strong all-round writing.",
  gemini: "Google’s AI. Often generous free tiers.",
  anthropic: "Claude’s maker. Careful, natural writing.",
  custom_cloud: "Any service that follows the OpenAI format, such as a gateway or a hosted open model.",
};

type Props = {
  /** Return to the local AI flow. */
  onUseLocal: () => void;
};

/**
 * Cloud AI, stated honestly.
 *
 * Each card's status comes from the same function the rest of CareerOS uses to decide whether a
 * cloud request may be sent. Today it reports "setup required" for every cloud service, because a
 * static website has no safe place to keep an API key. This screen therefore never offers a key
 * field and never shows a cloud service as connected.
 */
export default function CloudProviders({ onUseLocal }: Props) {
  return (
    <>
      <div className="cos-dialog-body">
        <p>Cloud AIs run on a company’s servers instead of your computer. They can be faster and stronger, but your text leaves this computer and usage may cost money.</p>

        <div className="ai-compare" role="table" aria-label="Local AI compared with cloud AI">
          <div role="row" className="ai-compare-head">
            <span role="columnheader" />
            <span role="columnheader"><Cpu size={14} aria-hidden="true" /> On this computer</span>
            <span role="columnheader"><Cloud size={14} aria-hidden="true" /> Cloud</span>
          </div>
          {[
            ["Where it runs", "Your computer", "The company’s servers"],
            ["Your résumé and answers", "Stay on this computer", "Are sent to the company"],
            ["Cost", "Free to run", "Often billed by use"],
            ["Setup", "Install an app once", "Needs an account and a key"],
          ].map(([label, local, cloud]) => (
            <div role="row" key={label}>
              <span role="rowheader">{label}</span>
              <span role="cell">{local}</span>
              <span role="cell">{cloud}</span>
            </div>
          ))}
        </div>

        <div className="cos-notice cos-notice-warning" role="note">
          <ShieldAlert size={16} aria-hidden="true" />
          <span>
            <strong>Cloud AI isn’t available yet.</strong> To use one safely, CareerOS needs a secure place to keep your key. A website can’t do that on its own, and CareerOS won’t accept a key it can’t protect. Nothing is sent to any cloud service.
          </span>
        </div>

        <ul className="ai-cloud-list" aria-label="Cloud services">
          {CLOUD_PROVIDERS.map((id) => {
            const preset = PROVIDERS[id];
            const status = evaluateCloudCredentialStatus(id, preset.defaultBaseUrl, false);
            return (
              <li key={id} className="ai-cloud-card" data-testid={`cloud-card-${id}`}>
                <div className="ai-cloud-main">
                  <strong>{plainProviderName(preset.label)}</strong>
                  <span className="cos-muted">{DESCRIPTIONS[id]}</span>
                  <span className="cos-muted">{preset.costGuidance}</span>
                </div>
                <span className={`cos-chip ${status.ready ? "cos-chip-info" : "cos-chip-warning"}`} data-testid={`cloud-status-${id}`}>
                  {status.ready ? "Available" : "Setup required"}
                </span>
              </li>
            );
          })}
        </ul>

        <details className="ai-fix">
          <summary>Why can’t I just paste a key?</summary>
          <p className="cos-muted">
            Anything typed into a web page can be read by other code running on that page, and saved keys are easy to leak through backups or shared computers. Rather than hold your key somewhere weak, CareerOS waits until it has somewhere strong, such as your operating system’s password storage. When that exists, this screen will say so, and only then.
          </p>
        </details>
      </div>

      <div className="cos-dialog-foot">
        <div className="ai-foot-left" />
        <div className="ai-foot-right">
          <button type="button" className="cos-btn cos-btn-primary" onClick={onUseLocal}>
            <ArrowLeft size={15} aria-hidden="true" /> Use AI on this computer instead
          </button>
        </div>
      </div>
    </>
  );
}
