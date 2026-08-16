import React from "react";

/**
 * Phase 8 avatar. Deliberately not a photorealistic face (that would be a
 * fake/undeliverable promise for a hackathon timeline) -- instead a calm
 * "signal orb" whose motion honestly represents state: still when idle,
 * bar-pulsing while it's listening to you, a slow orbiting dot while it's
 * thinking (waiting on the backend), breathing/glowing while it talks.
 */
export default function Avatar({ state = "idle", color = "#14213D", size = 84 }) {
  const ring =
    state === "listening" ? "#E6A23C" : state === "thinking" ? "#6C7A89" : state === "speaking" ? color : "#DAD5C8";

  return (
    <div
      className="relative flex items-center justify-center rounded-full"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Assistant avatar, currently ${state}`}
    >
      <div
        className={`absolute inset-0 rounded-full transition-all duration-500 ${
          state === "speaking" ? "animate-breathe" : ""
        }`}
        style={{
          background: `radial-gradient(circle at 35% 30%, ${color}22, ${color}05)`,
          border: `2px solid ${ring}`,
        }}
      />
      <div
        className="relative z-10 flex items-end justify-center gap-[3px]"
        style={{ width: size * 0.42, height: size * 0.42 }}
      >
        {state === "listening" ? (
          [0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="w-[4px] rounded-full animate-listenbar"
              style={{
                height: "100%",
                background: "#E6A23C",
                animationDelay: `${i * 0.12}s`,
              }}
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
        ) : (
          <span
            className="rounded-full"
            style={{
              width: state === "speaking" ? "60%" : "42%",
              height: state === "speaking" ? "60%" : "42%",
              background: color,
              transition: "all 400ms ease",
              opacity: 0.9,
            }}
          />
        )}
      </div>
    </div>
  );
}
