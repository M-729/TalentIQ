import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as hiringStepService from "./hiringStep.service";
import { serializeHiringStep, serializeHiringSteps } from "./hiringStep.serializer";
import type { CreateHiringStepInput, ReorderHiringStepsInput, UpdateHiringStepInput } from "./hiringStep.validation";

export const listHiringStepsHandler = asyncHandler(async (req: Request, res: Response) => {
  const steps = await hiringStepService.listHiringSteps(req.auth!.companyId, req.params.jobId!);
  res.status(200).json({ steps: serializeHiringSteps(steps) });
});

export const createHiringStepHandler = asyncHandler(async (req: Request, res: Response) => {
  const step = await hiringStepService.createHiringStep(
    req.auth!.companyId,
    req.params.jobId!,
    req.body as CreateHiringStepInput
  );
  res.status(201).json({ step: serializeHiringStep(step) });
});

export const updateHiringStepHandler = asyncHandler(async (req: Request, res: Response) => {
  const step = await hiringStepService.updateHiringStep(
    req.auth!.companyId,
    req.params.jobId!,
    req.params.stepId!,
    req.body as UpdateHiringStepInput
  );
  res.status(200).json({ step: serializeHiringStep(step) });
});

export const deleteHiringStepHandler = asyncHandler(async (req: Request, res: Response) => {
  await hiringStepService.deleteHiringStep(req.auth!.companyId, req.params.jobId!, req.params.stepId!);
  res.status(204).send();
});

export const reorderHiringStepsHandler = asyncHandler(async (req: Request, res: Response) => {
  const { orderedStepIds } = req.body as ReorderHiringStepsInput;
  const steps = await hiringStepService.reorderHiringSteps(req.auth!.companyId, req.params.jobId!, orderedStepIds);
  res.status(200).json({ steps: serializeHiringSteps(steps) });
});
