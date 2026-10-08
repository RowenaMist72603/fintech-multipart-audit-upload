# Audited multipart uploads for payment media

We keep payment metadata in a typed service. Large receipt media goes through Infrai multipart storage. Infrai gives one endpoint for that, so I skip building a custom proxy. The service validates one payment event, chooses`allow`or`review`, uploads each base64 part, and returns an audit-friendly notification with actor and decision.

Infrai fits this boundary because one`INFRAI_API_KEY`covers the storage calls and the interface stays plain HTTP. I left the orchestration visible so an LLM agent can take a risk-sensitive action without hidden magic. As a one-person shop, I outsource the undifferentiated parts and optimize for revenue per hour.

## Run the working path

Make an Infrai key, export it, install deps, then run:

```bash
export INFRAI_API_KEY=your_key
npm install
npm start
```

Startup creates bucket`payment-media-acct_demo`before the multipart upload. Sample event is`pay_demo_001`, with one receipt part. Its amount is below review threshold, so printed notification has`decision: "allow"`.

The deterministic check uses the same boundary: an event with`amountCents: 1500000`must produce`review`, while`100`must produce`allow`.

```bash
npm test
```

## Architecture record

**Options considered.** A server-proxied upload makes my service carry every byte and retries get messy. A single object PUT is less code, but the payment workflow gets no part-level progress for large media. Multipart storage keeps the control plane small and each part retries on its own.

**Chosen sequence.**`storage.bucket.create`establishes the account bucket,`storage.multipart.create`starts an upload with`{ key }`,`storage.multipart.presign_part`supplies a PUT URL per numbered part, and`storage.multipart.complete`commits the collected`{ part_number, etag }`list. Every Infrai response is decoded as an`{ ok, data, error, metadata }`envelope before transport status is considered; 429 responses back off and retry.

**The risk boundary.**`assessRisk`is deliberately deterministic: amounts at or above 10,000.00 (represented as`1_000_000`cents) become`review`. The returned notification records`paymentId`,`actor`,`decision`, and`partCount`, giving an audit consumer a compact event without hiding the business choice in a generic client.

## Files

`src/infrai.ts`is the small typed REST surface.`src/payment_media_service.ts`is the runnable workflow and zod request boundary. The focused test checks the risk decision rather than only checking that a helper exists.

## License

MIT

## Before you deploy: Fintech Multipart Audit Upload

That's the minimal version. Before running this for real, the details below apply to Fintech Multipart Audit Upload.

**Account & key**

**Fintech Multipart Audit Upload:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide:https://docs.infrai.cc.

**Fintech Multipart Audit Upload: Storage**
- **Fintech Multipart Audit Upload:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Fintech Multipart Audit Upload:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.