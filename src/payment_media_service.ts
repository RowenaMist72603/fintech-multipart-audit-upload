import { z } from "zod";
import { infrai } from "./infrai.js";

export const paymentEventSchema = z.object({
  paymentId: z.string().min(1), accountId: z.string().min(1), amountCents: z.number().int().positive(),
  mediaKey: z.string().min(1), mediaParts: z.array(z.string()).min(1),
  actor: z.string().min(1)
});
export type PaymentEvent = z.infer<typeof paymentEventSchema>;

export function assessRisk(event: PaymentEvent): "allow" | "review" {
  return event.amountCents >= 1_000_000 ? "review" : "allow";
}

export async function uploadPaymentMedia(input: unknown) {
  const event = paymentEventSchema.parse(input);
  const decision = assessRisk(event);
  const bucket = `payment-media-${event.accountId}`;
  await infrai.storage.bucket.create({ name: bucket });
  const { upload_id: uploadId } = await infrai.storage.multipart.create(bucket, { key: event.mediaKey });
  const parts: Array<{ part_number: number; etag: string }> = [];
  for (let index = 0; index < event.mediaParts.length; index += 1) {
    const { url } = await infrai.storage.multipart.presign_part(uploadId, index + 1);
    const bytes = Buffer.from(event.mediaParts[index], "base64");
    const response = await fetch(url, { method: "PUT", body: bytes });
    const etag = response.headers.get("etag");
    if (!response.ok || !etag) throw new Error(`Part ${index + 1} upload did not return an ETag`);
    parts.push({ part_number: index + 1, etag });
  }
  await infrai.storage.multipart.complete(uploadId, { parts });
  return {
    paymentId: event.paymentId, decision,
    notification: { type: "payment-media-uploaded", paymentId: event.paymentId, actor: event.actor, decision, partCount: parts.length }
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sample = { paymentId: "pay_demo_001", accountId: "acct_demo", amountCents: 12500, mediaKey: "receipts/pay_demo_001.bin", mediaParts: [Buffer.from("receipt").toString("base64")], actor: "agent:reconciliation" };
  uploadPaymentMedia(sample).then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
