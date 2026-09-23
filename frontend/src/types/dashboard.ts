export interface DashboardMetrics {
  open_jobs: number;
  new_applicants: number;
  upcoming_interviews: number;
  pending_offers: number;
  hired: number;
}

export interface DashboardApplicationRow {
  id: string;
  candidate: { id: string; name: string };
  job: { id: string; title: string };
  status: string;
  current_step: { id: string; name: string; type: string } | null;
  applied_at: string;
}

export interface DashboardInterviewRow {
  id: string;
  application_id: string;
  candidate: { id: string; name: string };
  job: { id: string; title: string };
  starts_at: string;
  timezone: string;
  status: string;
}

export interface DashboardAttention {
  failed_emails: number;
  assessments_awaiting_result: number;
  interviews_awaiting_feedback: number;
  offers_awaiting_response: number;
  offers_expiring_soon: number;
}

export interface Dashboard {
  metrics: DashboardMetrics;
  recent_applications: DashboardApplicationRow[];
  upcoming_interviews: DashboardInterviewRow[];
  attention: DashboardAttention;
}
