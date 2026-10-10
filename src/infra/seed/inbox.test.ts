import { describe, expect, it } from "vitest";
import { HE_INBOX } from "@/i18n/messages/he-inbox";
import { KEY_THREADS, ROUTINE_THREADS } from "./inbox";
import { C_SUITE } from "./org";

describe("inbox-v1 catalog", () => {
  it("gives every C-suite persona three threads that matter, each with a recommendation and a suggested reply", () => {
    for (const k of C_SUITE) {
      const mine = KEY_THREADS.filter((t) => t.owner === k);
      expect(mine.length, k).toBe(3);
      for (const t of mine) {
        expect(t.recommendation, t.id).toBeTruthy();
        expect(t.reply, t.id).toBeTruthy();
        expect(t.followUps.length, t.id).toBe(3);
      }
    }
    expect(new Set(KEY_THREADS.map((t) => t.id)).size).toBe(KEY_THREADS.length);
    // 3 + 12 routine = 15 per persona (mail-agent.md §2: 15–25).
    expect(KEY_THREADS.length / C_SUITE.length + ROUTINE_THREADS.length).toBe(15);
  });

  it("has Hebrew for every string a reader sees", () => {
    const missing: string[] = [];
    for (const t of [...KEY_THREADS, ...ROUTINE_THREADS]) {
      const texts = [t.subject, ...t.messages.map((m) => m.body), t.benefit, t.recommendation, t.reply];
      const w = t.with as { name?: string; role?: string };
      if (w && typeof w === "object" && w.name) texts.push(w.name, w.role);
      for (const x of texts) if (x && !(x in HE_INBOX)) missing.push(x);
    }
    expect(missing).toEqual([]);
  });
});
