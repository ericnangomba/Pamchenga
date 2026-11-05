import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import {
  createHostedWhisperHandler,
  HOSTED_MAX_AUDIO_BYTES,
} from "../netlify/lib/hosted-whisper";
const settings = {
  apiKey: "fixture-provider-key-not-real",
  accessCode: "fixture-pilot-access-code-not-real",
};
const original = Buffer.from("original native-language fixture audio");
const digest = createHash("sha256").update(original).digest("hex");
function request(
  options: {
    model?: string;
    language?: string;
    hash?: string;
    id?: string;
    code?: string;
    origin?: string;
    audio?: Blob;
    prompt?: string;
  } = {},
) {
  const body = new FormData();
  body.append(
    "audio",
    options.audio ?? new Blob([original], { type: "audio/wav" }),
    "original-audio",
  );
  body.append("job_id", options.id ?? randomUUID());
  body.append("audio_sha256", options.hash ?? digest);
  body.append("model", options.model ?? "turbo");
  body.append("language", options.language ?? "yo");
  body.append("region", "West Africa");
  body.append("prompt", options.prompt ?? "Iro nwanụ!");
  return new Request("https://pamchenga.netlify.app/api/transcriptions", {
    method: "POST",
    body,
    headers: {
      Origin: options.origin ?? "https://pamchenga.netlify.app",
      "X-Pamchenga-Access-Code": options.code ?? settings.accessCode,
    },
  });
}
const providerResult = {
  text: "Alo o! Iro nwanụ!",
  language: "yoruba",
  segments: [{ start: 0, end: 2, text: "Alo o! Iro nwanụ!" }],
};
test("hosted service fails closed before touching provider when configuration, access or origin is invalid", async () => {
  let calls = 0;
  const never: typeof fetch = async () => {
    calls++;
    throw Error("must not call");
  };
  assert.equal(
    (await createHostedWhisperHandler({}, never)(request())).status,
    503,
  );
  const handler = createHostedWhisperHandler(settings, never);
  assert.equal((await handler(request({ code: "" }))).status, 401);
  assert.equal((await handler(request({ code: "wrong" }))).status, 401);
  assert.equal(
    (await handler(request({ origin: "https://other.example" }))).status,
    403,
  );
  assert.equal(calls, 0);
  const health = await handler(
    new Request("https://pamchenga.netlify.app/api/transcriptions/health"),
  );
  const healthText = await health.text();
  assert.equal(JSON.parse(healthText).configured, true);
  assert.ok(!healthText.includes(settings.apiKey));
});
test("both hosted model mappings send intact audio and return bound native-text/timestamp drafts", async () => {
  for (const [model, providerModel] of [
    ["turbo", "whisper-large-v3-turbo"],
    ["large-v3", "whisper-large-v3"],
  ]) {
    let calls = 0;
    const provider: typeof fetch = async (input, init) => {
      calls++;
      assert.equal(
        String(input),
        "https://api.groq.com/openai/v1/audio/transcriptions",
      );
      assert.equal(
        new Headers(init?.headers).get("Authorization"),
        `Bearer ${settings.apiKey}`,
      );
      assert.equal(
        new Headers(init?.headers).get("X-Pamchenga-Access-Code"),
        null,
      );
      const data = init?.body as FormData;
      assert.equal(data.get("model"), providerModel);
      assert.equal(data.get("response_format"), "verbose_json");
      assert.equal(data.get("timestamp_granularities[]"), "segment");
      assert.equal(data.get("language"), "yo");
      assert.ok(String(data.get("prompt")).includes("Iro nwanụ!"));
      const audio = data.get("file") as File;
      assert.equal(audio.name, "original.wav");
      assert.deepEqual(Buffer.from(await audio.arrayBuffer()), original);
      return Response.json(providerResult);
    };
    const id = randomUUID();
    const response = await createHostedWhisperHandler(
      settings,
      provider,
    )(request({ model, id }));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.id, id);
    assert.equal(body.audioSha256, digest);
    assert.equal(body.result.model, model);
    assert.equal(body.result.text, "Alo o! Iro nwanụ!");
    assert.equal(body.status, "completed");
    assert.equal(calls, 1);
  }
});
test("hosted upload limits, source hashes and model/language validation prevent provider calls", async () => {
  let calls = 0;
  const provider: typeof fetch = async () => {
    calls++;
    return Response.json(providerResult);
  };
  const handler = createHostedWhisperHandler(settings, provider);
  for (const options of [
    { hash: "0".repeat(64) },
    { id: "not-a-uuid" },
    { model: "other" },
    { language: "ny" },
    { prompt: "x".repeat(400) },
  ])
    assert.equal((await handler(request(options))).status, 422);
  assert.equal(
    (
      await handler(
        request({
          audio: new Blob([new Uint8Array(HOSTED_MAX_AUDIO_BYTES + 1)], {
            type: "audio/wav",
          }),
        }),
      )
    ).status,
    413,
  );
  assert.equal(calls, 0);
});
test("automatic language detection is passed without forcing an unsupported language", async () => {
  const provider: typeof fetch = async (_input, init) => {
    assert.equal((init?.body as FormData).has("language"), false);
    return Response.json(providerResult);
  };
  assert.equal(
    (
      await createHostedWhisperHandler(
        settings,
        provider,
      )(request({ language: "auto" }))
    ).status,
    200,
  );
});
test("provider throttling and failures return sanitized retryable responses without leaking credentials", async () => {
  for (const [upstream, expected] of [
    [429, 429],
    [500, 503],
    [401, 503],
    [400, 422],
  ]) {
    const handler = createHostedWhisperHandler(
      settings,
      async () => new Response(settings.apiKey, { status: upstream }),
    );
    const response = await handler(request());
    assert.equal(response.status, expected);
    assert.ok(!(await response.text()).includes(settings.apiKey));
  }
  const response = await createHostedWhisperHandler(settings, async () => {
    throw Error(settings.apiKey);
  })(request());
  assert.equal(response.status, 504);
  assert.ok(!(await response.text()).includes(settings.apiKey));
});
test("malformed provider timestamps cannot become local transcription results", async () => {
  const handler = createHostedWhisperHandler(settings, async () =>
    Response.json({
      ...providerResult,
      segments: [{ start: -1, end: 2, text: "bad" }],
    }),
  );
  const response = await handler(request());
  assert.equal(response.status, 502);
  assert.equal((await response.json()).code, "INVALID_TRANSCRIPT");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});
