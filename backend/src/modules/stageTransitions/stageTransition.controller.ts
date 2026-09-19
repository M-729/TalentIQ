import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as stageTransitionService from "./stageTransition.service";
import { serializeStageTransition, serializeStageTransitions } from "./stageTransition.serializer";
import type { MoveApplicationStageInput } from "./stageTransition.validation";

export const moveApplicationStageHandler = asyncHandler(async (req: Request, res: Response) => {
  const { application, transition, movedByName } = await stageTransitionService.moveApplicationStage(
    req.auth!.companyId,
    req.auth!.userId,
    req.params.applicationId!,
    req.body as MoveApplicationStageInput
  );

  res.status(200).json({
    application: {
      id: application.id,
      status: application.status,
      current_step_id: application.current_step_id ? application.current_step_id.toString() : null,
    },
    transition: serializeStageTransition(transition, movedByName),
  });
});

export const getStageHistoryHandler = asyncHandler(async (req: Request, res: Response) => {
  const { transitions, movedByNames } = await stageTransitionService.getStageHistory(
    req.params.applicationId!,
    req.auth!.companyId
  );

  res.status(200).json({ transitions: serializeStageTransitions(transitions, movedByNames) });
});
