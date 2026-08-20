import React, { useState } from "react";
import { t } from "../utils/i18n.js";

const STEP_LABEL = {
  intent_detected: "Intent",
  permission_check: "Permission",
  permission_denied: "Permission",
  tool_call: "Tool call",
  security_block: "Security",
  clarification_needed: "Clarification",
};

function chipTone(step) {
  if (step.step === "permission_check") return step.allowed ? "success" : "danger";
  if (step.step === "permission_denied" || step.step === "security_block") return "danger";
  if (step.step === "tool_call") return "success";
  return "neutral";
}

const TONE_CLASSES = {
  success: "border-success/40 bg-success/10 text-success",
  danger: "border-danger/40 bg-danger/10 text-danger",
  neutral: "border-line bg-paper-alt text-muted",
};

function chipDetail(step) {
  switch (step.step) {
    case "intent_detected":
      return step.intent;
    case "permission_check":
      return step.allowed ? "allowed" : step.reason;
    case "permission_denied":
      return step.reason;
    case "tool_call":
      return step.tool;
    case "security_block":
      return step.reason;
    case "clarification_needed":
      return step.detail;
    default:
      return "";
  }
}

/**
 * The judge-facing transparency trace (spec section 8: "step-by-step trace
 * for judge-facing transparency: intent -> permission check -> tool call").
 * Rendered as a connected pipeline of chips rather than a raw JSON dump, so
 * a non-technical evaluator can read the authorization decision at a glance.
 */
export default function TraceRibbon({ trace, language }) {
  const [open, setOpen] = useState(false);
  if (!trace || trace.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`text-[11px] text-muted hover:text-ink transition-colors ${
          language === "en" ? "font-mono uppercase tracking-wide" : ""
        }`}
      >
        {open ? "▾" : "▸"} {t("trace", language)}
      </button>
      {open && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
          {trace.map((step, i) => (
            <React.Fragment key={i}>
              <span
                className={`rounded-md border px-2 py-1 ${TONE_CLASSES[chipTone(step)]}`}
                title={JSON.stringify(step)}
              >
                <span className="font-semibold">{STEP_LABEL[step.step] || step.step}</span>
                {chipDetail(step) ? <span className="opacity-70"> · {String(chipDetail(step))}</span> : null}
              </span>
              {i < trace.length - 1 && <span className="text-line">→</span>}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
