import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const companySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    industry: { type: String, trim: true },
    website: { type: String, trim: true },
    status: {
      type: String,
      enum: ["active", "inactive"] as const,
      default: "active",
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

export type CompanyDoc = HydratedDocument<InferSchemaType<typeof companySchema>>;

export const Company = model("Company", companySchema);
