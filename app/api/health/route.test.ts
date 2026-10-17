import { describe, it, expect } from "vitest";
import { GET } from "./route";

describe("/api/health route", () => {
  it("returns status ok and app metadata", async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("ok");
    expect(data.app).toBe("westeel-dashboard");
    expect(data.version).toBe("1.0.0");
    expect(data.timestamp).toBeDefined();
  });
});
