import { apiClient } from "@/services/api/client";
import type {
  CreateOfferInput,
  ListOffersFilters,
  Offer,
  OfferListRow,
  OfferNotification,
  UpdateOfferInput,
} from "@/types/offer";
import type { ApplicationDetail, Pagination } from "@/types/application";

export function getCurrentOfferForApplication(applicationId: string, signal?: AbortSignal): Promise<{ offer: Offer | null }> {
  return apiClient.get<{ offer: Offer | null }>(`/applications/${applicationId}/offer`, signal);
}

// Never sends an email — see the explicit, separate sendOffer below.
export function createOffer(applicationId: string, input: CreateOfferInput): Promise<{ offer: Offer }> {
  return apiClient.post<{ offer: Offer }>(`/applications/${applicationId}/offer`, input);
}

// Draft-only on the backend — locked once sent (see offer.service.ts's updateOffer).
export function updateOffer(offerId: string, input: UpdateOfferInput): Promise<{ offer: Offer }> {
  return apiClient.patch<{ offer: Offer }>(`/offers/${offerId}`, input);
}

export function sendOffer(offerId: string): Promise<{ notification: OfferNotification }> {
  return apiClient.post<{ notification: OfferNotification }>(`/offers/${offerId}/send`, {});
}

export function markOfferAccepted(offerId: string): Promise<{ offer: Offer }> {
  return apiClient.post<{ offer: Offer }>(`/offers/${offerId}/accept`, {});
}

export function markOfferDeclined(offerId: string): Promise<{ offer: Offer }> {
  return apiClient.post<{ offer: Offer }>(`/offers/${offerId}/decline`, {});
}

export function withdrawOffer(offerId: string): Promise<{ offer: Offer }> {
  return apiClient.post<{ offer: Offer }>(`/offers/${offerId}/withdraw`, {});
}

// Only allowed when Offer.status === "accepted" — see this ticket's
// explicit "Accepted does NOT automatically Hire" rule.
export function markApplicationHired(offerId: string): Promise<{ application: ApplicationDetail; offer: Offer }> {
  return apiClient.post<{ application: ApplicationDetail; offer: Offer }>(`/offers/${offerId}/hire`, {});
}

export function listOfferNotifications(offerId: string, signal?: AbortSignal): Promise<{ notifications: OfferNotification[] }> {
  return apiClient.get<{ notifications: OfferNotification[] }>(`/offers/${offerId}/notifications`, signal);
}

export function retryOfferNotification(offerId: string, notificationId: string): Promise<{ notification: OfferNotification }> {
  return apiClient.post<{ notification: OfferNotification }>(`/offers/${offerId}/notifications/${notificationId}/retry`, {});
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

// The /offers company-wide list.
export function listOffers(filters: ListOffersFilters, signal?: AbortSignal): Promise<{ offers: OfferListRow[]; pagination: Pagination }> {
  const query = buildQuery({
    jobId: filters.jobId,
    status: filters.status,
    search: filters.search,
    page: filters.page,
    limit: filters.limit,
  });
  return apiClient.get<{ offers: OfferListRow[]; pagination: Pagination }>(`/offers${query}`, signal);
}
