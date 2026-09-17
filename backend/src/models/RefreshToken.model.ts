import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const refreshTokenSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    token_hash: { type: String, required: true, unique: true },
    expires_at: { type: Date, required: true },
    revoked_at: { type: Date, default: null },
    replaced_by_token_hash: { type: String, default: null },
    created_by_ip: { type: String },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Used to sweep expired/revoked tokens; keeps the collection from growing unbounded.
refreshTokenSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export type RefreshTokenDoc = HydratedDocument<InferSchemaType<typeof refreshTokenSchema>>;

export const RefreshToken = model("RefreshToken", refreshTokenSchema);
