import { useCallback, useEffect, useRef, useState } from "react";
import { SPEECH_LOCALE } from "../utils/i18n.js";

/**
 * Wraps the browser's built-in Web Speech API (SpeechRecognition +
 * SpeechSynthesis) -- per .env.example, this is the documented no-key
 * fallback for voice, so Phase 7/8 need zero extra backend or npm work.
 * Support varies by browser (best in Chrome/Edge); we feature-detect and
 * surface `supported` so the UI can degrade gracefully instead of pretending
 * voice works everywhere.
 */
export function useSpeech(language) {
  const RecognitionCtor =
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);
  const synthAvailable = typeof window !== "undefined" && "speechSynthesis" in window;

  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const recognitionRef = useRef(null);

  const startListening = useCallback(
    (onResult) => {
      if (!RecognitionCtor) return;
      const recognition = new RecognitionCtor();
      recognition.lang = SPEECH_LOCALE[language] || "en-IN";
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onstart = () => setListening(true);
      recognition.onerror = () => setListening(false);
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
      recognition.start();
    },
    [RecognitionCtor, language]
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
    supported: Boolean(RecognitionCtor),
    ttsSupported: synthAvailable,
    listening,
    speaking,
    interimTranscript,
    startListening,
    stopListening,
    speak,
    cancelSpeaking,
  };
}
