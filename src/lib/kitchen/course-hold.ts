export function parseCourseHoldInput(input: {
  holdForCourse?: unknown;
  courseLabel?: unknown;
}): { isHeld: boolean; courseLabel: string | null } {
  if (
    input.holdForCourse !== undefined &&
    typeof input.holdForCourse !== "boolean"
  ) {
    throw new Error("Course hold must be true or false.");
  }
  if (
    input.courseLabel !== undefined &&
    typeof input.courseLabel !== "string"
  ) {
    throw new Error("Course label must be text.");
  }
  const label = (input.courseLabel ?? "").trim();
  if (label.length > 40) throw new Error("Course label is too long.");
  if (input.holdForCourse && !label) {
    throw new Error("Name the course before holding the kitchen round.");
  }
  if (!input.holdForCourse && label) {
    throw new Error("A course label requires a held kitchen round.");
  }
  return { isHeld: input.holdForCourse === true, courseLabel: label || null };
}
