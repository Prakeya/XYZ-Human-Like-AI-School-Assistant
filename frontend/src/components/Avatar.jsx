import React from "react";

/**
 * State-driven conversational AI avatar with speech-synchronized animation.
 *
 * Honest scope (see README "Avatar" section): this is NOT a photorealistic
 * face and does NOT do phoneme-level lip-sync. It's a calm "signal orb" whose
 * motion truthfully represents what's happening -- still when idle, bar-pulsing
 * while it's listening to you, an orbiting ring while it's waiting on the
 * backend, and a mouth shape that opens/closes on a talking cadence for the
 * duration of speech playback while it's speaking. An ERROR state gives
 * visible, honest feedback when something failed instead of silently idling.
 *
 * Each of the four personas (student/parent/teacher/principal) gets a
 * distinct inner glyph -- not just a different color -- so the four
 * dashboards feel like four different assistants at a glance, per spec
 * section 4 ("create distinct visual identity for Student/Parent/Teacher/
 * Principal Assistant").
 */

const ROLE_GLYPH = {
  student: "book", // open book -- academic assistant
  parent: "heart", // caring/reassuring
  teacher: "square", // structured/professional
  principal: "diamond", // oversight/management
};

function Glyph({ shape, size, color }) {
  const s = size;
  switch (shape) {
    case "book":
      return (
        <svg viewBox="0 0 24 24" width={s} height={s} fill="none">
          <path
            d="M12 5.5c-1.8-1.3-4-1.8-6-1.5v13c2 0 4.2.5 6 1.7 1.8-1.2 4-1.7 6-1.7v-13c-2-.3-4.2.2-6 1.5Z"
            fill={color}
            opacity="0.85"
          />
          <path d="M12 5.5v13" stroke="#F4F2ED" strokeWidth="0.9" opacity="0.7" />
        </svg>
      );
    case "heart":
      return (
        <svg viewBox="0 0 24 24" width={s} height={s} fill="none">
          <path
            d="M12 19.5s-7-4.35-9.3-8.83C1.2 7.7 2.9 4.7 6 4.4c2-.2 3.6 1 4.5 2.4.9-1.4 2.5-2.6 4.5-2.4 3.1.3 4.8 3.3 3.3 6.27C19 15.15 12 19.5 12 19.5Z"
            fill={color}
            opacity="0.85"
          />
        </svg>
      );
    case "square":
      return (
        <svg viewBox="0 0 24 24" width={s} height={s} fill="none">
          <rect x="4" y="4" width="16" height="16" rx="3" fill={color} opacity="0.85" />
          <rect x="7.5" y="7.5" width="9" height="2" rx="1" fill="#F4F2ED" opacity="0.7" />
          <rect x="7.5" y="11" width="9" height="2" rx="1" fill="#F4F2ED" opacity="0.55" />
          <rect x="7.5" y="14.5" width="6" height="2" rx="1" fill="#F4F2ED" opacity="0.4" />
        </svg>
      );
    case "diamond":
    default:
      return (
        <svg viewBox="0 0 24 24" width={s} height={s} fill="none">
          <path d="M12 3 20 12 12 21 4 12 12 3Z" fill={color} opacity="0.85" />
          <path d="M12 3 20 12 12 21" stroke="#F4F2ED" strokeWidth="0.7" opacity="0.5" fill="none" />
        </svg>
      );
  }
}

export default function Avatar({ state = "idle", role = "student", color = "#14213D", size = 84 }) {
  const glyphShape = ROLE_GLYPH[role] || "book";

  const ring =
    state === "error"
      ? "#B23A48"
      : state === "listening"
      ? "#E6A23C"
      : state === "thinking"
      ? "#6C7A89"
      : state === "speaking"
      ? color
      : "#DAD5C8";

  return (
    <div
      className={`relative flex items-center justify-center rounded-full ${
        state === "error" ? "animate-errorshake" : ""
      }`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Assistant avatar, currently ${state}`}
    >
      <div
        className={`absolute inset-0 rounded-full transition-all duration-500 ${
          state === "speaking" ? "animate-breathe" : ""
        }`}
        style={{
          background:
            state === "error"
              ? "radial-gradient(circle at 35% 30%, #B23A4822, #B23A4805)"
              : `radial-gradient(circle at 35% 30%, ${color}22, ${color}05)`,
          border: `2px solid ${ring}`,
        }}
      />

      <div
        className="relative z-10 flex items-end justify-center gap-[3px]"
        style={{ width: size * 0.46, height: size * 0.46 }}
      >
        {state === "listening" ? (
          [0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="w-[4px] rounded-full animate-listenbar"
              style={{ height: "100%", background: "#E6A23C", animationDelay: `${i * 0.12}s` }}
            />
          ))
        ) : state === "thinking" ? (
          <span
            className="rounded-full animate-spin"
            style={{
              width: "100%",
              height: "100%",
              border: "2.5px solid transparent",
              borderTopColor: "#6C7A89",
              borderRightColor: "#6C7A89",
            }}
          />
        ) : state === "error" ? (
          <svg viewBox="0 0 24 24" width={size * 0.42} height={size * 0.42} fill="none">
            <circle cx="12" cy="12" r="10" stroke="#B23A48" strokeWidth="1.6" opacity="0.6" />
            <path d="M12 7v6" stroke="#B23A48" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="16.3" r="1.15" fill="#B23A48" />
          </svg>
        ) : state === "speaking" ? (
          // "Face": two steady eyes (with a slow, subtle idle-look drift) above
          // a mouth bar that opens and closes on a talking cadence for as long
          // as speech.speaking is true -- i.e. synchronized to the actual
          // duration of TTS playback, not a fixed-length clip.
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex gap-[7px] animate-eyeshift">
              <span className="h-[5px] w-[5px] rounded-full" style={{ background: color }} />
              <span className="h-[5px] w-[5px] rounded-full" style={{ background: color }} />
            </div>
            <span
              className="animate-mouthtalk rounded-full"
              style={{ width: size * 0.22, height: size * 0.1, background: color, transformOrigin: "center" }}
            />
          </div>
        ) : (
          <Glyph shape={glyphShape} size={size * 0.42} color={color} />
        )}
      </div>
    </div>
  );
}
