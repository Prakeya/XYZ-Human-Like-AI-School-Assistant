// Persona copy per spec section 9 -- purely presentational (avatar tone, colors,
// greeting chrome). Actual chat responses still come from the backend.
export const PERSONAS = {
  student: {
    label: "Student",
    title: "Academic Assistant",
    tagline: "Friendly and supportive",
    color: "#3E7CB1",
    initial: "S",
  },
  parent: {
    label: "Parent",
    title: "Parent Support Assistant",
    tagline: "Caring and patient",
    color: "#A65D3E",
    initial: "P",
  },
  teacher: {
    label: "Teacher",
    title: "Teaching Assistant",
    tagline: "Professional and precise",
    color: "#4F6F52",
    initial: "T",
  },
  principal: {
    label: "Principal",
    title: "Management Assistant",
    tagline: "Professional and strategic",
    color: "#5B4B8A",
    initial: "M",
  },
};

export function personaFor(role) {
  return PERSONAS[role] || PERSONAS.student;
}
