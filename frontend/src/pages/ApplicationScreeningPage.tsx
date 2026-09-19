import { useEffect, useRef, useState } from "react";
import { AlertCircle, SearchX } from "lucide-react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AiDisclaimer } from "@/components/screenings/AiDisclaimer";
import { AiSummaryCard } from "@/components/screenings/AiSummaryCard";
import { EducationCard } from "@/components/screenings/EducationCard";
import { ExperienceCard } from "@/components/screenings/ExperienceCard";
import { ExtractedSkillsCard } from "@/components/screenings/ExtractedSkillsCard";
import { RequiredSkillBreakdown } from "@/components/screenings/RequiredSkillBreakdown";
import { RerunConfirmDialog } from "@/components/screenings/RerunConfirmDialog";
import { ScreeningDetailsCard } from "@/components/screenings/ScreeningDetailsCard";
import { ScreeningEmptyState } from "@/components/screenings/ScreeningEmptyState";
import { ScreeningHistoryList } from "@/components/screenings/ScreeningHistoryList";
import { ScreeningPageContextHeader } from "@/components/screenings/ScreeningPageContextHeader";
import { ScreeningResultHeader } from "@/components/screenings/ScreeningResultHeader";
import { StrengthsGapsCards } from "@/components/screenings/StrengthsGapsCards";
import { useApplication } from "@/hooks/useApplication";
import { useCreateScreening } from "@/hooks/useCreateScreening";
import { useLatestScreening } from "@/hooks/useLatestScreening";
import { useScreeningHistory } from "@/hooks/useScreeningHistory";
import type { Screening } from "@/types/screening";

const SUCCESS_FLASH_MS = 4000;

export function ApplicationScreeningPage() {
  const { applicationId } = useParams<{ applicationId: string }>();

  const application = useApplication(applicationId);
  const latest = useLatestScreening(applicationId);
  const history = useScreeningHistory(applicationId);
  const create = useCreateScreening(applicationId);

  // Holds the screening returned by a just-completed POST. Using this
  // (rather than re-fetching /latest) means the previous result never
  // has to disappear while the new one loads, and there's no extra round
  // trip — the POST response IS the new canonical latest screening.
  const [latestOverride, setLatestOverride] = useState<Screening | null>(null);
  const effectiveLatest = latestOverride ?? latest.screening;

  const [viewMode, setViewMode] = useState<"latest" | "historical">("latest");
  const [selectedHistoricalId, setSelectedHistoricalId] = useState<string | null>(null);
  const [rerunDialogOpen, setRerunDialogOpen] = useState(false);
  const [showSuccessFlash, setShowSuccessFlash] = useState(false);
  const successFlashTimeout = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (successFlashTimeout.current) window.clearTimeout(successFlashTimeout.current);
    };
  }, []);

  function flashSuccess() {
    setShowSuccessFlash(true);
    if (successFlashTimeout.current) window.clearTimeout(successFlashTimeout.current);
    successFlashTimeout.current = window.setTimeout(() => setShowSuccessFlash(false), SUCCESS_FLASH_MS);
  }

  async function handleRun() {
    const result = await create.run();
    if (result) {
      setLatestOverride(result);
      history.refetch();
      flashSuccess();
    }
  }

  async function handleConfirmRerun() {
    const result = await create.run();
    setRerunDialogOpen(false);
    if (result) {
      setLatestOverride(result);
      setViewMode("latest");
      setSelectedHistoricalId(null);
      history.refetch();
      flashSuccess();
    }
  }

  function handleSelectHistorical(screeningId: string) {
    setSelectedHistoricalId(screeningId);
    setViewMode("historical");
  }

  function handleBackToLatest() {
    setViewMode("latest");
    setSelectedHistoricalId(null);
  }

  const historicalScreening =
    viewMode === "historical" && selectedHistoricalId
      ? (history.screenings?.find((s) => s.id === selectedHistoricalId) ?? null)
      : null;
  const displayedScreening = historicalScreening ?? effectiveLatest;
  const isHistorical = historicalScreening !== null;

  if (!applicationId) {
    return null;
  }

  // Candidate/job context loads independently of the screening data below
  // (its own isLoading) — neither blocks the other, and it's rendered in
  // every branch so HR always sees whose application this is, even while
  // the screening itself is loading/missing/erroring.
  const contextHeader = (
    <ScreeningPageContextHeader
      applicationId={applicationId}
      application={application.application}
      isLoading={application.isLoading}
    />
  );

  if (latest.isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        {contextHeader}
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (latest.notFound) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        {contextHeader}
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <SearchX className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium text-foreground">This application is unavailable.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (latest.error) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        {contextHeader}
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertCircle className="size-8 text-destructive" aria-hidden="true" />
            <div>
              <p className="font-medium text-foreground">Couldn't load this screening</p>
              <p className="text-sm text-muted-foreground">{latest.error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={latest.refetch}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {contextHeader}

      {!displayedScreening ? (
        <ScreeningEmptyState isRunning={create.isCreating} onRun={handleRun} />
      ) : (
        <>
          <ScreeningResultHeader
            screening={displayedScreening}
            isHistorical={isHistorical}
            isCreating={create.isCreating}
            createError={create.error}
            showSuccessFlash={showSuccessFlash}
            onRequestRerun={() => setRerunDialogOpen(true)}
            onBackToLatest={handleBackToLatest}
          />

          <RequiredSkillBreakdown breakdown={displayedScreening.match.breakdown} />

          <AiSummaryCard summary={displayedScreening.analysis.summary} />

          <ExtractedSkillsCard skills={displayedScreening.analysis.skills} />

          <div className="grid gap-4 sm:grid-cols-2">
            <ExperienceCard experience={displayedScreening.analysis.experience} />
            <EducationCard education={displayedScreening.analysis.education} />
          </div>

          <StrengthsGapsCards strengths={displayedScreening.analysis.strengths} gaps={displayedScreening.analysis.gaps} />

          <ScreeningDetailsCard screening={displayedScreening} />

          <AiDisclaimer className="text-center text-xs text-muted-foreground" />

          {!history.isLoading && !history.error && history.screenings && (
            <ScreeningHistoryList screenings={history.screenings} onSelect={handleSelectHistorical} />
          )}
        </>
      )}

      <RerunConfirmDialog
        open={rerunDialogOpen}
        onOpenChange={setRerunDialogOpen}
        onConfirm={handleConfirmRerun}
        isCreating={create.isCreating}
      />
    </div>
  );
}
