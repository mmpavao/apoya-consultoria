import { afterEach, describe, expect, it } from "vitest";
import { getApoyaServiceToken, getMcpUrl, requireEnv } from "./worker-env";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete (globalThis as { __env__?: Record<string, string> }).__env__;
});

describe("requireEnv", () => {
  it("retorna valor de process.env", () => {
    process.env.TEST_KEY = "abc";
    expect(requireEnv("TEST_KEY")).toBe("abc");
  });

  it("lança quando ausente", () => {
    delete process.env.MISSING_KEY;
    expect(() => requireEnv("MISSING_KEY")).toThrow(/não configurado/);
  });
});

describe("getApoyaServiceToken", () => {
  it("lê APOYA_SERVICE_TOKEN", () => {
    process.env.APOYA_SERVICE_TOKEN = "token-secreto";
    expect(getApoyaServiceToken()).toBe("token-secreto");
  });

  it("fail-closed sem token", () => {
    delete process.env.APOYA_SERVICE_TOKEN;
    expect(() => getApoyaServiceToken()).toThrow(/APOYA_SERVICE_TOKEN/);
  });
});

describe("getMcpUrl", () => {
  it("usa MCP_URL quando definido", () => {
    process.env.MCP_URL = "https://custom.example/mcp";
    expect(getMcpUrl()).toBe("https://custom.example/mcp");
  });

  it("staging quando WORKER_ENV=staging", () => {
    delete process.env.MCP_URL;
    process.env.WORKER_ENV = "staging";
    expect(getMcpUrl()).toContain("apoya-mcp-staging");
  });
});
