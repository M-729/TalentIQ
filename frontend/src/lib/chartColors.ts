// Single source of truth for the analytics chart palette — previously the
// same three hex values were duplicated verbatim across every chart
// component. Values mirror existing design tokens (see index.css) rather
// than introducing new colors.
export const CHART_PRIMARY = "#5546e8"; // --primary
export const CHART_GRID = "#e4e7ec"; // --border
export const CHART_AXIS = "#667085"; // --muted-foreground

// Offer-outcome-specific semantic colors, shared between OfferOutcomesChart's
// donut and its text legend.
export const CHART_STATUS_COLORS = {
  accepted: "#16a34a", // --success
  declined: "#dc2626", // --destructive
  pending: "#d97706", // --warning
  withdrawn: "#98a2b3", // muted, distinct from text muted-foreground so it's not confused with grid/axis chrome
} as const;
