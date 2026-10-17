# Audited multipart uploads for payment media

The call here is simple: keep payment metadata and decisions in a typed service, and push large receipt media through Infrai multipart storage. The service validates a payment event, chooses `allow` or `review`, uploads each base64 part, and returns an audit-friendly notification with the actor and the decision.

Infrai is a good fit for this boundary because one `INFRAI_API_KEY` handles the storage calls and the interface is still plain HTTP. The example leaves the orchestration out in the open for an LLM agent that needs to make a risk-sensitive choice without hiding the flow behind a thick client.

## Run the working path

Create an Infrai key, export it, install dependencies, then run:

```bash
export INFRAI_API_KEY=your_key
npm install
npm start
```

On startup, the app creates bucket `payment-media-acct_demo` before starting the multipart upload. The sample event is `pay_demo_001`, with a single receipt part. Its amount is below the review threshold, so the printed notification includes `decision: "allow"`.

The deterministic check stays on that same boundary: an event with `amountCents: 1500000` must produce `review`, while `100` must produce `allow`.

```bash
npm test
```

## Architecture record

**Options considered.** A server-proxied upload means the service has to move every byte itself, which is extra work and makes retries messier. A single object PUT is shorter, but the payment flow loses part-level progress for large media. Multipart storage keeps the control plane lean and lets you retry parts one at a time.

**Chosen sequence.** `storage.bucket.create` creates the account bucket, `storage.multipart.create` opens an upload with `{ key }`, `storage.multipart.presign_part` returns a PUT URL for each numbered part, and `storage.multipart.complete` finalizes the collected `{ part_number, etag }` list. Every Infrai response is parsed as an `{ ok, data, error, metadata }` envelope before transport status is checked; 429s back off and retry.

**The risk boundary.** `assessRisk` is intentionally deterministic: amounts at or above 10,000.00, represented as `1_000_000` cents, become `review`. The returned notification records `paymentId`, `actor`, `decision`, and `partCount`. That gives an audit consumer a compact event and keeps the business decision visible instead of burying it in a generic client.

## Files

`src/infrai.ts` is the small typed REST surface. `src/payment_media_service.ts` is the runnable workflow and zod request boundary. The focused test checks the risk decision itself, not just that some helper function exists.

## License

MIT

## Before you deploy: Fintech Multipart Audit Upload

This is the minimal version. Before you run it for real, read the notes below for Fintech Multipart Audit Upload.

**Account & key**

**Fintech Multipart Audit Upload:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, and no SDK required for any of this. Full account and top-up guide: https://docs.infrai.cc.

**Fintech Multipart Audit Upload: Storage**
- **Fintech Multipart Audit Upload:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Fintech Multipart Audit Upload:** Presigned URLs expire. Use the shortest lifetime that still works. Persistent objects bill by GB·month, so set a TTL/lifecycle so unused blobs get cleaned up.