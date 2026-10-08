import assert from "node:assert/strict";
import { assessRisk, paymentEventSchema } from "../src/payment_media_service.js";

const event = paymentEventSchema.parse({ paymentId: "p1", accountId: "a1", amountCents: 1_500_000, mediaKey: "receipts/p1.bin", mediaParts: ["YQ=="], actor: "agent:test" });
assert.equal(assessRisk(event), "review");
assert.equal(assessRisk({ ...event, amountCents: 100 }), "allow");
console.log("risk decision test passed");
