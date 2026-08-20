import { useCallback, useEffect, useRef, useState } from "react";
import { SPEECH_LOCALE } from "../utils/i18n.js";

/**
 * Wraps the browser's built-in Web Speech API (SpeechRecognition +
 * SpeechSynthesis) -- per .env.example, this is the documented no-key
 * fallback for voice, so Phase 7/8 need zero extra backend or npm work.
 * Support varies by browser (best in Chrome/Edge); we feature-detect and
 * surface `supported` so the UI can degrade gracefully instead of pretending
 * voice works everywhere.
 *
 * Two failure modes used to be totally silent (button just did nothing):
 *  1. SpeechRecognition requires a secure context (https, or localhost).
 *     Served over plain http, `window.SpeechRecognition` may still exist
 *     but `.start()` fails instantly with no prompt and no usable error --
 *     so we check `window.isSecureContext` up front and report it as
 *     unsupported with a specific reason instead of pretending it'll work.
 *  2. `recognition.onerror` (mic permission denied, no mic, no network --
 *     the API calls out to a speech service) only ever did
 *     `setListening(false)`, with nothing shown to the user. Now the last
 *     error is exposed as `micError` so the UI can surface *why* nothing
 *     happened.
 */
export function useSpeech(language) {
  const secureContext = typeof window !== "undefined" && window.isSecureContext !== false;
  const RecognitionCtor =
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);
  const synthAvailable = typeof window !== "undefined" && "speechSynthesis" in window;
  const recognitionSupported = Boolean(RecognitionCtor) && secureContext;

  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [micError, setMicError] = useState(null);
  const recognitionRef = useRef(null);

  const startListening = useCallback(
    (onResult) => {
      setMicError(null);
      if (!recognitionSupported) {
        setMicError(!secureContext ? "insecure-context" : "unsupported");
        return;
      }
      let recognition;
      try {
        recognition = new RecognitionCtor();
      } catch {
        setMicError("unsupported");
        return;
      }
      recognition.lang = SPEECH_LOCALE[language] || "en-IN";
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onstart = () => setListening(true);
      recognition.onerror = (event) => {
        setListening(false);
        // event.error values per spec: "not-allowed" (mic permission denied
        // or blocked by browser policy), "audio-capture" (no mic found),
        // "network" (the browser's speech service is unreachable),
        // "no-speech" (timed out with no input -- not really an "error"
        // worth alarming the user about), etc.
        setMicError(event.error === "no-speech" ? null : event.error || "unknown");
      };
      recognition.onend = () => setListening(false);
      recognition.onresult = (event) => {
        let finalText = "";
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) finalText += transcript;
          else interim += transcript;
        }
        setInterimTranscript(interim);
        if (finalText) {
          onResult(finalText.trim());
          setInterimTranscript("");
        }
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch {
        // Most commonly InvalidStateError from a stray double-click (start()
        // called while a recognition session is already starting/active).
        // Swallowing this used to be silent; now at least surface it.
        setListening(false);
        setMicError("unknown");
      }
    },
    [RecognitionCtor, recognitionSupported, secureContext, language]
  );

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const speak = useCallback(
    (text) => {
      if (!synthAvailable || !text) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = SPEECH_LOCALE[language] || "en-IN";
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utterance);
    },
    [synthAvailable, language]
  );

  const cancelSpeaking = useCallback(() => {
    if (synthAvailable) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [synthAvailable]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (synthAvailable) window.speechSynthesis.cancel();
    };
  }, [synthAvailable]);

  return {
    supported: recognitionSupported,
    ttsSupported: synthAvailable,
    listening,
    speaking,
    interimTranscript,
    micError,
    clearMicError: () => setMicError(null),
    startListening,
    stopListening,
    speak,
    cancelSpeaking,
  };
}
