// Mirrors backend/src/modules/applications/application.validation.ts exactly
// — only fields the public API actually accepts. No status/pipeline/company
// fields exist here; those are backend-derived or not part of this ticket.
export interface SubmitApplicationInput {
  full_name: string;
  email: string;
  phone?: string;
  location?: string;
  linkedin_url?: string;
  portfolio_url?: string;
}
