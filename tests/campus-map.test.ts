import { describe, expect, it } from "vitest";
import { BUILDINGS, findPlace, NODES, PLACES, planCampusRoute, routeBetween } from "../src/lib/campus-map";

describe("findPlace", () => {
  it.each([
    ["examination section", "block-b"],
    ["Where is the exam cell?", "block-b"],
    ["girls' hostel", "h3"],
    ["placement cell", "innovation"],
    ["accounts section", "admin"],
    ["Room A-102", "admin"],
    ["A-010", "block-a"],
    ["block a", "block-a"],
    ["Block C", "block-c"],
    ["gym", "indoor"],
    ["xerox", "student-centre"],
    ["canteen", "food-court"],
    ["library café", "library"],
    ["doctor", "health"],
    ["bus stop", "bus-bay"],
  ])("%s -> %s", (query, id) => {
    expect(findPlace(query)?.id).toBe(id);
  });

  it("returns null for places that aren't on campus", () => {
    expect(findPlace("swimming pool")).toBeNull();
    expect(findPlace("")).toBeNull();
  });
});

describe("routeBetween", () => {
  it("walks from the gate down the avenue and turns at Jacaranda Circle", () => {
    const r = routeBetween("gate", "block-b")!;
    expect(r.steps[0]).toBe("Start at the Main Gate.");
    expect(r.steps[1]).toMatch(/^Head south along Gate Avenue for about \d+ m/);
    expect(r.steps.join(" ")).toMatch(/At Jacaranda Circle, turn left onto Central Walk/);
    expect(r.steps.at(-1)).toBe("Block B is on your left.");
    expect(r.points[0]).toEqual([480, 44]);
    expect(r.distanceM).toBeGreaterThan(150);
    expect(r.distanceM).toBeLessThanOrEqual(320);
    expect(r.minutes).toBeGreaterThanOrEqual(2);
  });

  it("mentions landmarks passed on the way", () => {
    const r = routeBetween("gate", "food-court")!;
    expect(r.steps.join(" ")).toMatch(/passing the Admin Block on your right, the Auditorium on your left/);
  });

  it("handles neighbours that share an entrance", () => {
    const r = routeBetween("admin", "auditorium")!;
    expect(r.steps).toEqual(["Start at the Admin Block.", "The Auditorium is straight ahead."]);
  });

  it("can reach every building from every other", () => {
    for (const a of BUILDINGS) for (const b of BUILDINGS) if (a.id !== b.id) expect(routeBetween(a.id, b.id), `${a.id} -> ${b.id}`).not.toBeNull();
  });

  it("only uses junctions and doors that exist", () => {
    for (const b of BUILDINGS) expect(NODES[b.via], b.id).toBeDefined();
    for (const p of PLACES) for (const id of p.buildings) expect(BUILDINGS.some((b) => b.id === id), `${p.id}: ${id}`).toBe(true);
  });
});

describe("planCampusRoute", () => {
  it("defaults to starting at the Main Gate", () => {
    const r = planCampusRoute({ to: "health centre" });
    expect(r.from?.id).toBe("main-gate");
    expect(r.to?.detail).toMatch(/next to Hostel Block H2/i);
    expect(r.route?.steps.length).toBeGreaterThan(2);
  });

  it("goes to the nearest of several buildings", () => {
    const r = planCampusRoute({ to: "mess", from: "Block C" });
    expect(r.to?.id).toBe("mess");
    expect(r.route?.steps.at(-1)).toMatch(/Hostel Block H1/);
  });

  it("knows when the start already is the place", () => {
    const r = planCampusRoute({ to: "mess", from: "girls hostel" });
    expect(r).toMatchObject({ sameBuilding: true, route: null });
  });

  it("reports names it can't place", () => {
    const r = planCampusRoute({ to: "swimming pool" });
    expect(r.unknown).toBe("swimming pool");
    expect(r.route).toBeNull();
    expect(r.known).toContain("Central Library");
  });

  it("shows the whole campus when no place is given", () => {
    const r = planCampusRoute({});
    expect(r).toMatchObject({ to: null, from: null, route: null, unknown: null, sameBuilding: false });
  });
});
