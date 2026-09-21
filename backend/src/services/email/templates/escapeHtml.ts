// Shared by every interview email template — candidate/interviewer/job/
// company names all originate from user-controlled or database input, so
// none of them are ever interpolated into HTML unescaped. Mirrors
// applicationConfirmation.template.ts's own local escapeHtml exactly;
// pulled into one shared helper now that multiple templates need it.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
