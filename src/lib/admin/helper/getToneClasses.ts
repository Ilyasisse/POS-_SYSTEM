type Tone = "blue" | "green" | "purple" | "orange" | "pink" | "slate";
export function getToneClasses(tone: Tone) {
  // Stores the class pairs for each supported tone.
  const tones = {
    blue: {
      icon: "bg-blue-50 text-blue-600",
      soft: "bg-blue-50 text-blue-700",
    },
    green: {
      icon: "bg-emerald-50 text-emerald-600",
      soft: "bg-emerald-50 text-emerald-700",
    },
    purple: {
      icon: "bg-purple-50 text-purple-600",
      soft: "bg-purple-50 text-purple-700",
    },
    orange: {
      icon: "bg-orange-50 text-orange-600",
      soft: "bg-orange-50 text-orange-700",
    },
    pink: {
      icon: "bg-pink-50 text-pink-600",
      soft: "bg-pink-50 text-pink-700",
    },
    slate: {
      icon: "bg-slate-100 text-slate-600",
      soft: "bg-slate-100 text-slate-700",
    },
  };

  return tones[tone];
}