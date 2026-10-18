/**
 * cradleBus — a tiny transient channel from the DOM practice index to the
 * Newton's cradle. PracticeIndex writes the hovered practice (0..5, or -1);
 * the cradle reads it inside useFrame. A plain mutable object, never React
 * state, so hovering never re-renders the canvas.
 */
export const cradleBus = { hover: -1 };
