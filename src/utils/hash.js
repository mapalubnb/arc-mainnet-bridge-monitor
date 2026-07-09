import crypto from "node:crypto";

export const sha256 = (text) => crypto.createHash("sha256").update(text || "").digest("hex");
