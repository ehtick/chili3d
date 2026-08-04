// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type IShape, Matrix4, PubSub, Result, type ShapeType, ShapeTypes, XYZ } from "@chili3d/core";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "@rstest/core";
import { ExtendCommand } from "../../../src/commands/modify/extend";
import {
    ensureGlobalStubApp,
    type MockShape,
    mockShape,
    seedStepDatas,
    shapeStepResult,
    stubTransactionRun,
    type TrackingParent,
    wireCommand,
} from "../commandTestUtils";

let restoreApp: () => void;
beforeAll(() => {
    restoreApp = ensureGlobalStubApp();
});
afterAll(() => restoreApp());

/**
 * A trimmed line curve: `basisCurve`/`direction` make `CurveUtils.isTrimmed`
 * and `CurveUtils.isLine` pass; `value(u)` maps a basis parameter to a point.
 */
function lineCurve(start: XYZ, direction: XYZ, first: number, last: number) {
    return {
        basisCurve: { direction },
        firstParameter: () => first,
        lastParameter: () => last,
        value: (u: number) => start.add(direction.multiply(u - first)),
    };
}

/**
 * A trimmed circle curve in the XY plane: `basisCurve`/`center`/`radius` make
 * `CurveUtils.isCircle` pass; `value(u)` evaluates the point at angle u.
 */
function arcCurve(center: XYZ, radius: number, u1: number, u2: number) {
    return {
        basisCurve: { center, radius, axis: XYZ.unitZ },
        firstParameter: () => u1,
        lastParameter: () => u2,
        value: (u: number) => center.add(new XYZ({ x: radius * Math.cos(u), y: radius * Math.sin(u), z: 0 })),
    };
}

/** `parameter(point)` of a full-circle temporary edge spanning [from, from + 2π). */
function circleParameter(center: XYZ, from: number) {
    return (point: XYZ) => {
        let angle = Math.atan2(point.y - center.y, point.x - center.x);
        while (angle < from) angle += 2 * Math.PI;
        while (angle > from + 2 * Math.PI) angle -= 2 * Math.PI;
        return angle;
    };
}

/** A standalone edge-body parent or a wire parent whose `isPartner` only matches itself. */
function typedParent(shapeType: ShapeType) {
    const parent = mockShape({ shapeType });
    (parent as any).isPartner = (other: unknown) => other === parent;
    return parent;
}

interface TempEdgeSpec {
    /** Intersections returned by the temporary (maximal) edge's `intersect`. */
    intersections?: { point: XYZ; parameter: number }[];
    /** `parameter(point)` of the temporary (maximal) edge's curve. */
    curveParameter?: (point: XYZ) => number | undefined;
}

/**
 * The shape partial of a line or arc edge: `trim` records its arguments and
 * pushes the edge it returns into `created`, so tests can assert how the edge
 * was extended and which edges the wire was rebuilt from. The trimmed edges
 * expose the `intersect`/`curve.parameter` the temporary edges need.
 */
function curveEdgeData(
    parent: unknown,
    curve: unknown,
    trims: unknown[][],
    created: MockShape[],
    spec: TempEdgeSpec = {},
): Partial<IShape> {
    return {
        shapeType: ShapeTypes.edge,
        parent,
        curve,
        trim: (...args: unknown[]) => {
            trims.push(args);
            const edge = mockShape({
                shapeType: ShapeTypes.edge,
                parent,
                intersect: () => spec.intersections ?? [],
                curve: { parameter: (point: XYZ) => spec.curveParameter?.(point) },
            } as Partial<MockShape>);
            created.push(edge);
            return edge;
        },
    } as unknown as Partial<IShape>;
}

function edgeNode(name: string, parent: TrackingParent, body: unknown, document: unknown) {
    return {
        name,
        document,
        shape: { value: body },
        transform: Matrix4.identity(),
        materialId: "mat-1",
        parent,
        previousSibling: undefined,
        nextSibling: undefined,
    };
}

/** Replace the stub factory with a proxy recording calls per method name. */
function captureFactory(impls: Record<string, () => unknown> = {}) {
    const original = (globalThis as any).app.shapeProvider.factory;
    const calls: Record<string, any[][]> = {};
    Object.defineProperty((globalThis as any).app.shapeProvider, "factory", {
        configurable: true,
        value: new Proxy(
            {},
            {
                get:
                    (_t, prop) =>
                    (...args: any[]) => {
                        const key = prop as string;
                        calls[key] ??= [];
                        calls[key].push(args);
                        return (impls[key] ?? (() => Result.ok(mockShape())))();
                    },
            },
        ),
    });
    return {
        calls,
        restore: () =>
            Object.defineProperty((globalThis as any).app.shapeProvider, "factory", {
                configurable: true,
                value: original,
            }),
    };
}

/** Replace `PubSub.default.pub` with a recorder. */
function capturePubSub() {
    const original = PubSub.default.pub;
    const pubs: any[][] = [];
    PubSub.default.pub = ((...args: any[]) => {
        pubs.push(args);
    }) as any;
    return {
        pubs,
        restore: () => {
            PubSub.default.pub = original;
        },
    };
}

/** Two perpendicular segments: [0,1] on the X axis and [1,2] on the vertical line x=3. */
const X_CURVE = () => lineCurve(XYZ.zero, XYZ.unitX, 0, 1);
const Y_CURVE = () => lineCurve(new XYZ({ x: 3, y: 1, z: 0 }), XYZ.unitY, 1, 2);

/**
 * A command seeded with two selected edges of a wire. The wire's
 * `findSubShapes` returns `allEdges`, where index 1 and 2 match the selected
 * sub-edges via `isEqual`.
 */
function buildWireCommand(opts: { curves?: [unknown, unknown] } = {}) {
    const cmd = new ExtendCommand();
    const { doc } = wireCommand(cmd);
    const parent = doc.modelManager.rootNode as unknown as TrackingParent;
    const wire = typedParent(ShapeTypes.wire);

    const trims: [unknown[][], unknown[][]] = [[], []];
    const created: MockShape[] = [];
    const [curve1, curve2] = opts.curves ?? [X_CURVE(), Y_CURVE()];
    const step = shapeStepResult([
        { shape: curveEdgeData(wire, curve1, trims[0], created), node: edgeNode("wire0", parent, wire, doc) },
        { shape: curveEdgeData(wire, curve2, trims[1], created), node: edgeNode("wire0", parent, wire, doc) },
    ]);
    seedStepDatas(cmd, [step]);

    const sel0 = (cmd as any).stepDatas[0].shapes[0].shape;
    const sel1 = (cmd as any).stepDatas[0].shapes[1].shape;
    const allEdges = [mockShape(), mockShape(), mockShape()];
    (allEdges[1] as any).isEqual = (other: unknown) => other === sel0;
    (allEdges[2] as any).isEqual = (other: unknown) => other === sel1;
    (wire as any).findSubShapes = () => allEdges;

    return { cmd, doc, parent, wire, trims, created, allEdges, sel0, sel1 };
}

/** Builds the shape partial of one selected standalone edge. */
type EdgeFactory = (ctx: { body: unknown; trims: unknown[][]; created: MockShape[] }) => Partial<IShape>;

/** A command seeded with edges of two standalone edge bodies. */
function buildStandaloneCommand(opts: { count?: 1 | 2; shapes?: [EdgeFactory, EdgeFactory] } = {}) {
    const cmd = new ExtendCommand();
    const { doc } = wireCommand(cmd);
    const parent = doc.modelManager.rootNode as unknown as TrackingParent;
    const body = mockShape({ shapeType: ShapeTypes.edge });

    const trims: [unknown[][], unknown[][]] = [[], []];
    const created: MockShape[] = [];
    const factories: EdgeFactory[] = opts.shapes ?? [
        (ctx) => curveEdgeData(ctx.body, X_CURVE(), ctx.trims, ctx.created),
        (ctx) => curveEdgeData(ctx.body, Y_CURVE(), ctx.trims, ctx.created),
    ];
    const entries = factories.slice(0, opts.count ?? 2).map((factory, i) => ({
        shape: factory({ body, trims: trims[i], created }),
        node: edgeNode(`edge${i}`, parent, body, doc),
    }));
    seedStepDatas(cmd, [shapeStepResult(entries)]);

    return { cmd, doc, parent, trims, created };
}

describe("ExtendCommand", () => {
    let restoreTx: () => void;
    beforeEach(() => {
        restoreTx = stubTransactionRun();
    });
    afterEach(() => restoreTx());

    test("should have command metadata", () => {
        const data = (ExtendCommand as any).prototype.data;
        expect(data).not.toBeNull();
        expect(data.key).toBe("modify.extend");
    });

    test("getSteps should return a single edge-selection step finishing on two edges", () => {
        const cmd = new ExtendCommand();
        const steps = (cmd as any).getSteps();
        expect(steps.length).toBe(1);
        expect(steps[0].snapeType).toBe(ShapeTypes.edge);
        expect(steps[0].options.multiple).toBe(true);

        const canFinish = steps[0].options.canFinish;
        expect(canFinish([{ shape: mockShape() }])).toBe(false);
        expect(canFinish([{ shape: mockShape() }, { shape: mockShape() }])).toBe(true);
    });

    describe("edgeFilter", () => {
        const edgeOn = (parent: unknown) =>
            mockShape({ shapeType: ShapeTypes.edge, parent } as Partial<MockShape>);
        const filterOf = (cmd: ExtendCommand) => (cmd as any).getSteps()[0].options.shapeFilter;

        test("should allow wire and standalone edges but reject other parents", () => {
            const { cmd } = buildWireCommand();
            const filter = filterOf(cmd);

            expect(filter.allow(edgeOn(typedParent(ShapeTypes.wire)), Matrix4.identity())).toBe(true);
            expect(filter.allow(edgeOn(typedParent(ShapeTypes.edge)), Matrix4.identity())).toBe(true);
            expect(filter.allow(edgeOn(typedParent(ShapeTypes.face)), Matrix4.identity())).toBe(false);
            expect(filter.allow(edgeOn(typedParent(ShapeTypes.solid)), Matrix4.identity())).toBe(false);
            expect(filter.allow(edgeOn(typedParent(ShapeTypes.shell)), Matrix4.identity())).toBe(false);
        });

        test("should only allow edges of the first edge's wire", () => {
            const { cmd, doc, wire } = buildWireCommand();
            (doc.selection as any).getSelectedShapes = () => [{ shape: edgeOn(wire) }];

            const filter = filterOf(cmd);
            expect(filter.allow(edgeOn(wire), Matrix4.identity())).toBe(true);
            expect(filter.allow(edgeOn(typedParent(ShapeTypes.wire)), Matrix4.identity())).toBe(false);
            expect(filter.allow(edgeOn(typedParent(ShapeTypes.edge)), Matrix4.identity())).toBe(false);
        });

        test("should only allow standalone edges after a standalone edge is selected", () => {
            const { cmd, doc } = buildStandaloneCommand();
            const body = typedParent(ShapeTypes.edge);
            (doc.selection as any).getSelectedShapes = () => [{ shape: edgeOn(body) }];

            const filter = filterOf(cmd);
            expect(filter.allow(edgeOn(typedParent(ShapeTypes.edge)), Matrix4.identity())).toBe(true);
            expect(filter.allow(edgeOn(typedParent(ShapeTypes.wire)), Matrix4.identity())).toBe(false);
        });

        test("should only allow re-picking a selected edge once two are selected", () => {
            const { cmd, doc, wire } = buildWireCommand();
            const first = edgeOn(wire);
            const second = edgeOn(wire);
            (doc.selection as any).getSelectedShapes = () => [{ shape: first }, { shape: second }];

            const filter = filterOf(cmd);
            expect(filter.allow(edgeOn(wire), Matrix4.identity())).toBe(false);

            const repick = edgeOn(wire);
            (first as any).isEqual = (other: unknown) => other === repick;
            expect(filter.allow(repick, Matrix4.identity())).toBe(true);
        });
    });

    describe("executeMainTask", () => {
        test("should extend two edges of a wire to their intersection and rebuild the wire", () => {
            const { cmd, parent, trims, created, allEdges } = buildWireCommand();

            const { calls, restore } = captureFactory();
            try {
                (cmd as any).executeMainTask();

                // X segment [0,1] extended to x=3, Y segment [1,2] extended to y=0
                expect(trims[0]).toEqual([[0, 3]]);
                expect(trims[1]).toEqual([[0, 2]]);

                expect(calls["wire"]).toHaveLength(1);
                expect(calls["wire"][0][0]).toEqual([allEdges[0], created[0], created[1]]);
                expect(parent.added).toHaveLength(1);
                expect(parent.removed).toHaveLength(1);
            } finally {
                restore();
            }
        });

        test("should keep the longer side when the intersection cuts an edge", () => {
            const longX = lineCurve(XYZ.zero, XYZ.unitX, 0, 4); // intersection at x=3 cuts it
            const { cmd, trims } = buildWireCommand({ curves: [longX, Y_CURVE()] });

            const { restore } = captureFactory();
            try {
                (cmd as any).executeMainTask();
                expect(trims[0]).toEqual([[0, 3]]); // [0,3] is longer than [3,4]
                expect(trims[1]).toEqual([[0, 2]]);
            } finally {
                restore();
            }
        });

        test("should report an error for parallel wire edges and keep the node", () => {
            const parallel = lineCurve(new XYZ({ x: 0, y: 5, z: 0 }), XYZ.unitX, 0, 2);
            const { cmd, parent } = buildWireCommand({ curves: [X_CURVE(), parallel] });

            const pubsub = capturePubSub();
            try {
                (cmd as any).executeMainTask();

                expect(pubsub.pubs.some((args) => args[0] === "displayError")).toBe(true);
                expect(parent.added).toHaveLength(0);
                expect(parent.removed).toHaveLength(0);
            } finally {
                pubsub.restore();
            }
        });

        test("should report an error for non-coplanar wire edges and keep the node", () => {
            const offPlane = lineCurve(new XYZ({ x: 3, y: 1, z: 7 }), XYZ.unitY, 1, 2); // parallel plane at z=7
            const { cmd, parent } = buildWireCommand({ curves: [X_CURVE(), offPlane] });

            const pubsub = capturePubSub();
            try {
                (cmd as any).executeMainTask();

                expect(pubsub.pubs.some((args) => args[0] === "displayError")).toBe(true);
                expect(parent.added).toHaveLength(0);
                expect(parent.removed).toHaveLength(0);
            } finally {
                pubsub.restore();
            }
        });

        test("should report an error when the wire edges are not adjacent", () => {
            const { cmd, wire, sel0, sel1, allEdges, parent } = buildWireCommand();
            // a 4-edge wire where the selected edges sit at index 0 and 2
            const wider = [mockShape(), mockShape(), mockShape(), mockShape()];
            (wider[0] as any).isEqual = (other: unknown) => other === sel0;
            (wider[2] as any).isEqual = (other: unknown) => other === sel1;
            (wire as any).findSubShapes = () => wider;

            const pubsub = capturePubSub();
            try {
                (cmd as any).executeMainTask();

                expect(pubsub.pubs.some((args) => args[0] === "displayError")).toBe(true);
                expect(parent.added).toHaveLength(0);
                expect(allEdges.length).toBe(3); // sanity: the wire no longer returns the original list
            } finally {
                pubsub.restore();
            }
        });

        test("should extend two standalone edges and replace their nodes", () => {
            const { cmd, parent, trims, created } = buildStandaloneCommand();

            (cmd as any).executeMainTask();

            expect(trims[0]).toEqual([[0, 3]]);
            expect(trims[1]).toEqual([[0, 2]]);
            expect(parent.added).toHaveLength(2);
            expect(parent.removed).toHaveLength(2);

            const [added1, added2] = parent.added as any[];
            expect(added1.name).toBe("edge0");
            expect(added1.shape.value).toBe(created[0]);
            expect(added2.name).toBe("edge1");
            expect(added2.shape.value).toBe(created[1]);
        });

        test("should report an error and keep the nodes when only one standalone edge is selected", () => {
            const { cmd, parent } = buildStandaloneCommand({ count: 1 });

            const pubsub = capturePubSub();
            try {
                (cmd as any).executeMainTask();

                expect(pubsub.pubs.some((args) => args[0] === "displayError")).toBe(true);
                expect(parent.added).toHaveLength(0);
                expect(parent.removed).toHaveLength(0);
            } finally {
                pubsub.restore();
            }
        });

        test("should report an error for non-straight edges and keep the nodes", () => {
            const { cmd, parent } = buildStandaloneCommand();
            // strip the line direction so the basis curve is no longer a line
            (cmd as any).stepDatas[0].shapes[0].shape.curve.basisCurve = {};

            const pubsub = capturePubSub();
            try {
                (cmd as any).executeMainTask();

                expect(pubsub.pubs.some((args) => args[0] === "displayError")).toBe(true);
                expect(parent.added).toHaveLength(0);
                expect(parent.removed).toHaveLength(0);
            } finally {
                pubsub.restore();
            }
        });
    });

    describe("arcs", () => {
        test("should extend a line and an arc to their nearest intersection", () => {
            const center = new XYZ({ x: 2, y: 4, z: 0 });
            // the full circle meets the X axis at x=-1 and x=5; the arc already passes
            // through (5,0), so it is the geometrically nearest intersection even though
            // (-1,0) is closer to the arc in parameter (angle) space
            const intersections = [
                { point: new XYZ({ x: -1, y: 0, z: 0 }), parameter: -1 },
                { point: new XYZ({ x: 5, y: 0, z: 0 }), parameter: 5 },
            ];
            const { cmd, parent, trims, created } = buildStandaloneCommand({
                shapes: [
                    (ctx) => curveEdgeData(ctx.body, X_CURVE(), ctx.trims, ctx.created, { intersections }),
                    (ctx) =>
                        curveEdgeData(ctx.body, arcCurve(center, 5, -1.2, 0), ctx.trims, ctx.created, {
                            curveParameter: circleParameter(center, -1.2),
                        }),
                ],
            });

            (cmd as any).executeMainTask();

            expect(trims[0].at(-1)).toEqual([0, 5]); // the last trim is the extended edge
            expect(trims[1].at(-1)![0]).toBeCloseTo(Math.atan2(-4, 3)); // keeps the longer side
            expect(trims[1].at(-1)![1]).toBe(0);
            expect(parent.added).toHaveLength(2);
            expect(parent.removed).toHaveLength(2);
            const [added1, added2] = parent.added as any[];
            expect(added1.shape.value).toBe(created.at(-2));
            expect(added2.shape.value).toBe(created.at(-1));
        });

        test("should extend two arcs to their nearest intersection", () => {
            const h = Math.sqrt(1.75); // y of the intersections of the two full circles
            const a = Math.atan2(h, 1.5); // the intersection's angle on circle A
            const centerB = new XYZ({ x: 3, y: 0, z: 0 });
            const u = Math.PI / 2;
            // the full circles meet at (1.5, ±h); the upper point needs less extension
            const intersections = [
                { point: new XYZ({ x: 1.5, y: h, z: 0 }), parameter: a },
                { point: new XYZ({ x: 1.5, y: -h, z: 0 }), parameter: 2 * Math.PI - a },
            ];
            const { cmd, trims } = buildStandaloneCommand({
                shapes: [
                    (ctx) =>
                        curveEdgeData(ctx.body, arcCurve(XYZ.zero, 2, u, Math.PI), ctx.trims, ctx.created, {
                            intersections,
                        }),
                    (ctx) =>
                        curveEdgeData(ctx.body, arcCurve(centerB, 2, u, Math.PI), ctx.trims, ctx.created, {
                            curveParameter: circleParameter(centerB, u),
                        }),
                ],
            });

            (cmd as any).executeMainTask();

            // A extended back to the intersection angle, B keeps its longer side up to it
            expect(trims[0].at(-1)![0]).toBeCloseTo(a);
            expect(trims[0].at(-1)![1]).toBeCloseTo(Math.PI);
            expect(trims[1].at(-1)![0]).toBeCloseTo(u);
            expect(trims[1].at(-1)![1]).toBeCloseTo(Math.PI - a);
        });

        test("should report an error when the line and the arc never meet", () => {
            const center = new XYZ({ x: 3, y: 5, z: 0 }); // the circle stays clear of the X axis
            const { cmd, parent } = buildStandaloneCommand({
                shapes: [
                    (ctx) =>
                        curveEdgeData(ctx.body, X_CURVE(), ctx.trims, ctx.created, { intersections: [] }),
                    (ctx) =>
                        curveEdgeData(ctx.body, arcCurve(center, 1, 0, 1), ctx.trims, ctx.created, {
                            curveParameter: circleParameter(center, 0),
                        }),
                ],
            });

            const pubsub = capturePubSub();
            try {
                (cmd as any).executeMainTask();

                expect(pubsub.pubs.some((args) => args[0] === "displayError")).toBe(true);
                expect(parent.added).toHaveLength(0);
                expect(parent.removed).toHaveLength(0);
            } finally {
                pubsub.restore();
            }
        });

        test("should report an error when the arc would become a full circle", () => {
            const u1 = 0.0005; // an almost full circle with a tiny gap around angle 0
            const tangentLine = lineCurve(new XYZ({ x: 1, y: -1, z: 0 }), XYZ.unitY, -1, 0.5);
            const intersections = [{ point: new XYZ({ x: 1, y: 0, z: 0 }), parameter: 0 }];
            const { cmd, parent } = buildStandaloneCommand({
                shapes: [
                    (ctx) => curveEdgeData(ctx.body, tangentLine, ctx.trims, ctx.created, { intersections }),
                    (ctx) =>
                        curveEdgeData(
                            ctx.body,
                            arcCurve(XYZ.zero, 1, u1, 2 * Math.PI - u1),
                            ctx.trims,
                            ctx.created,
                            { curveParameter: circleParameter(XYZ.zero, u1) },
                        ),
                ],
            });

            const pubsub = capturePubSub();
            try {
                (cmd as any).executeMainTask();

                expect(pubsub.pubs.some((args) => args[0] === "displayError")).toBe(true);
                expect(parent.added).toHaveLength(0);
                expect(parent.removed).toHaveLength(0);
            } finally {
                pubsub.restore();
            }
        });
    });
});
