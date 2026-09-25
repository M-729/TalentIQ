import { Schema, model, Types, type FilterQuery, type InferSchemaType, type HydratedDocument } from "mongoose";
import { generatePublicId } from "../utils/publicId";

export const USER_ROLES = ["HR", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["active", "invited", "disabled"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

const userSchema = new Schema(
  {
    // Opaque, URL-facing identifier — used only by the Team Settings
    // Deactivate/Reactivate path
    // (`/team/members/:userId/deactivate|reactivate`). See utils/publicId.ts
    // and Job.model.ts's public_id field for the full rationale. Never
    // used for authentication — the JWT's own `sub` claim (a real Mongo
    // _id) remains the sole identity used by requireAuth/req.auth.userId.
    public_id: { type: String, unique: true, sparse: true },
    company_id: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    // Never selected by default so a hash can't accidentally leak in an API response.
    password_hash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, required: true },
    status: { type: String, enum: USER_STATUSES, default: "active" },
    last_login_at: { type: Date },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Assigns public_id exactly once, only for a brand-new document — same
// pattern/rationale as Job.model.ts's own pre("validate") hook.
userSchema.pre("validate", function assignPublicId(next) {
  if (this.isNew && !this.public_id) {
    this.public_id = generatePublicId("user");
  }
  next();
});

userSchema.index({ company_id: 1, role: 1 });

export type UserDoc = HydratedDocument<InferSchemaType<typeof userSchema>>;
type UserShape = InferSchemaType<typeof userSchema>;

/** URL/route id resolution for the Team Settings Deactivate/Reactivate path — see Job.model.ts's jobIdentifierFilter for the full rationale. Public-id only (Phase 2 cutover). */
export function userIdentifierFilter(idParam: string): FilterQuery<UserShape> {
  return { public_id: idParam };
}

export interface UserAuthShape {
  _id: Types.ObjectId;
  company_id: Types.ObjectId;
  role: UserRole;
  status: UserStatus;
}

export const User = model("User", userSchema);
