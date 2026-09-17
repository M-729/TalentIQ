import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from "mongoose";

export const USER_ROLES = ["HR", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["active", "invited", "disabled"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

const userSchema = new Schema(
  {
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

userSchema.index({ company_id: 1, role: 1 });

export type UserDoc = HydratedDocument<InferSchemaType<typeof userSchema>>;

export interface UserAuthShape {
  _id: Types.ObjectId;
  company_id: Types.ObjectId;
  role: UserRole;
  status: UserStatus;
}

export const User = model("User", userSchema);
