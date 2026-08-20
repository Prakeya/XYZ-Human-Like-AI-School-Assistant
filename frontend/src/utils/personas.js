// Persona copy per spec section 9 -- purely presentational (avatar tone, colors,
// greeting chrome). Actual chat responses still come from the backend.
//
// label/title/tagline are resolved through utils/i18n.js so persona copy is
// translated along with everything else. PERSONA_META below only carries the
// language-independent bits (color, initial) plus the i18n keys to look up;
// use personaFor(role, language) to get the fully-resolved, translated persona.
import { t } from "./i18n.js";

export const PERSONA_META = {
  student: {
    labelKey: "roleStudent",
    titleKey: "personaTitleStudent",
    taglineKey: "personaTaglineStudent",
    color: "#3E7CB1",
    initial: "S",
  },
  parent: {
    labelKey: "roleParent",
    titleKey: "personaTitleParent",
    taglineKey: "personaTaglineParent",
    color: "#A65D3E",
    initial: "P",
  },
  teacher: {
    labelKey: "roleTeacher",
    titleKey: "personaTitleTeacher",
    taglineKey: "personaTaglineTeacher",
    color: "#4F6F52",
    initial: "T",
  },
  principal: {
    labelKey: "rolePrincipal",
    titleKey: "personaTitlePrincipal",
    taglineKey: "personaTaglinePrincipal",
    color: "#5B4B8A",
    initial: "M",
  },
};

function personaShape(meta, language) {
  return {
    label: t(meta.labelKey, language),
    title: t(meta.titleKey, language),
    tagline: t(meta.taglineKey, language),
    color: meta.color,
    initial: meta.initial,
  };
}

export function personaFor(role, language = "en") {
  const meta = PERSONA_META[role] || PERSONA_META.student;
  return personaShape(meta, language);
}

// Back-compat export for callers that iterate over all roles (e.g. Login.jsx's
// role tabs / persona legend). Kept as English-labelled by default since it's
// a static export with no language in scope -- callers that need the current
// language should use PERSONA_META + personaFor/t directly (see Login.jsx).
export const PERSONAS = Object.fromEntries(
  Object.entries(PERSONA_META).map(([role, meta]) => [role, personaShape(meta, "en")])
);
