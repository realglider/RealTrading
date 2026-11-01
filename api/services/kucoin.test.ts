import { afterEach, describe, expect, it, vi } from "vitest";
import { testCredentials } from "./kucoin";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("KuCoin network diagnostics", () => {
  it("explains a failed private API connection without sending an order", async () => {
    const failure = Object.assign(new Error("fetch failed"), { cause: { code: "ECONNREFUSED" } });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(failure));
    await expect(testCredentials("spot", {
      key: "test-key-not-a-credential",
      secret: "test-secret-not-a-credential",
      passphrase: "test-passphrase",
      keyVersion: "3",
    })).rejects.toThrow("KuCoin-Spot-API ist vom Server nicht erreichbar (ECONNREFUSED)");
  });
});
