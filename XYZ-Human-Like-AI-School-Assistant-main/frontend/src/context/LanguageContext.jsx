import React, { createContext, useContext, useState } from "react";

const LanguageContext = createContext(null);
const STORAGE_KEY = "xyzai_language";

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(
    () => localStorage.getItem(STORAGE_KEY) || "en"
  );

  const changeLanguage = (code) => {
    setLanguage(code);
    localStorage.setItem(STORAGE_KEY, code);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: changeLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
