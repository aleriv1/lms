import type { PublicUser, UserRole, UserStatus } from "@lms/shared";
import { type HydratedDocument, model, Schema } from "mongoose";

export type UserAttributes = {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  groupName: string | null;
  status: UserStatus;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UserDocument = HydratedDocument<UserAttributes>;

const userSchema = new Schema<UserAttributes>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["student", "teacher", "admin"],
      default: "student",
    },
    groupName: { type: String, default: null },
    status: {
      type: String,
      enum: ["active", "blocked", "archived"],
      default: "active",
    },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const User = model<UserAttributes>("User", userSchema);

/** The only way a user leaves the server. */
export function toPublicUser(user: UserDocument): PublicUser {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    groupName: user.groupName,
    status: user.status,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
