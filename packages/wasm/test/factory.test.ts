// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { type IFace, type IShape, type IWire, Line, Plane, ShapeTypes, XYZ } from "@chili3d/core";
import { MockShape } from "@chili3d/core/test-utils";
import type { ShapeFactory } from "../src/factory";
import type { OccEdge, OccFace, OccSolid } from "../src/shape";
import { OccCylindricalSurface, OccPlane } from "../src/surface";
import { createTestFactory, surfaceOfFace, unwrapOk } from "./helpers";
import "./setup";

let factory: ShapeFactory;

beforeEach(() => {
    factory = createTestFactory();
});

const plane = Plane.XY;
const shiftedPlane = new Plane({
    origin: new XYZ({ x: 5, y: 0, z: 0 }),
    normal: XYZ.unitZ,
    xvec: XYZ.unitX,
});

// ============================================================================
// Basic primitives
// ============================================================================

describe("ShapeFactory — basic primitives", () => {
    describe("box", () => {
        test("should create a box successfully", () => {
            const result = factory.box(plane, 10, 20, 30);
            expect(result.isOk).toBe(true);
            expect(result.value).toBeDefined();
            expect(result.value.shapeType).toBe(ShapeTypes.solid);
        });

        test("box should have non-empty mesh", () => {
            const result = factory.box(plane, 10, 20, 30);
            const faces = result.value.mesh.faces;
            expect(faces).toBeDefined();
            if (!faces) return;
            expect(faces.position.length).toBeGreaterThan(0);
            expect(faces.index.length).toBeGreaterThan(0);
            expect(faces.index.length % 3).toBe(0);
        });
    });

    describe("sphere", () => {
        test("should create a sphere successfully", () => {
            const result = factory.sphere(XYZ.zero, 10);
            expect(result.isOk).toBe(true);
            expect(result.value.shapeType).toBe(ShapeTypes.solid);
        });
    });

    describe("cylinder", () => {
        test("should create a cylinder successfully", () => {
            const result = factory.cylinder(XYZ.unitZ, XYZ.zero, 5, 20);
            expect(result.isOk).toBe(true);
            expect(result.value.shapeType).toBe(ShapeTypes.solid);
        });
    });

    describe("cone", () => {
        test("should create a cone successfully", () => {
            const result = factory.cone(XYZ.unitZ, XYZ.zero, 5, 3, 20);
            expect(result.isOk).toBe(true);
            expect(result.value.shapeType).toBe(ShapeTypes.solid);
        });
    });

    describe("pyramid", () => {
        test("should create a pyramid successfully", () => {
            const result = factory.pyramid(plane, 10, 10, 20);
            expect(result.isOk).toBe(true);
            expect(result.value.shapeType).toBe(ShapeTypes.solid);
        });
    });
});

// ============================================================================
// Curves & wires
// ============================================================================

describe("ShapeFactory — curves & wires", () => {
    describe("line", () => {
        test("should create a line successfully", () => {
            const result = factory.line(XYZ.zero, XYZ.unitX);
            expect(result.isOk).toBe(true);
            expect(result.value.shapeType).toBe(ShapeTypes.edge);
        });

        test("should return error when start and end are too close", () => {
            const result = factory.line(XYZ.zero, XYZ.zero);
            expect(result.isOk).toBe(false);
            expect(result.error).toBe("The start and end points are too close.");
        });
    });

    describe("arc", () => {
        test("should create an arc successfully", () => {
            const result = factory.arc(XYZ.unitZ, XYZ.zero, XYZ.unitX, 90);
            expect(result.isOk).toBe(true);
            expect(result.value.shapeType).toBe(ShapeTypes.edge);
        });

        test("should create a full-circle arc (360°)", () => {
            const result = factory.arc(XYZ.unitZ, XYZ.zero, XYZ.unitX, 360);
            expect(result.isOk).toBe(true);
        });
    });

    describe("circle", () => {
        test("should create a circle successfully", () => {
            const result = factory.circle(XYZ.unitZ, XYZ.zero, 5);
            expect(result.isOk).toBe(true);
            expect(result.value.shapeType).toBe(ShapeTypes.edge);
        });
    });

    describe("ellipse", () => {
        test("should create an ellipse successfully", () => {
            const result = factory.ellipse(XYZ.unitZ, XYZ.zero, XYZ.unitX, 10, 5);
            expect(result.isOk).toBe(true);
            expect(result.value.shapeType).toBe(ShapeTypes.edge);
        });
    });

    describe("bezier", () => {
        test("should create a bezier curve from three points", () => {
            const points = [XYZ.zero, new XYZ({ x: 10, y: 0, z: 0 }), new XYZ({ x: 10, y: 10, z: 0 })];
            const result = factory.bezier(points);
            expect(result.isOk).toBe(true);
            expect(result.value.shapeType).toBe(ShapeTypes.edge);
        });

        test("should create a bezier curve with weights", () => {
            const points = [XYZ.zero, new XYZ({ x: 10, y: 0, z: 0 }), new XYZ({ x: 10, y: 10, z: 0 })];
            const result = factory.bezier(points, [1, 2, 1]);
            expect(result.isOk).toBe(true);
        });
    });

    describe("rect", () => {
        test("should create a rectangle face", () => {
            const result = factory.rect(plane, 10, 20);
            expect(result.isOk).toBe(true);
            expect(result.value.shapeType).toBe(ShapeTypes.face);
        });
    });

    describe("polygon", () => {
        test("should create a polygon wire from 4 points", () => {
            const points = [
                XYZ.zero,
                new XYZ({ x: 10, y: 0, z: 0 }),
                new XYZ({ x: 10, y: 10, z: 0 }),
                new XYZ({ x: 0, y: 10, z: 0 }),
            ];
            const result = factory.polygon(points);
            expect(result.isOk).toBe(true);
            expect(result.value.shapeType).toBe(ShapeTypes.wire);
        });
    });

    describe("point", () => {
        test("should create a vertex point", () => {
            const result = factory.point(XYZ.zero);
            expect(result.isOk).toBe(true);
            expect(result.value.shapeType).toBe(ShapeTypes.vertex);
        });
    });

    describe("wire", () => {
        test("should create a wire from edges", () => {
            const e1 = factory.line(XYZ.zero, new XYZ({ x: 10, y: 0, z: 0 })).value;
            const e2 = factory.line(new XYZ({ x: 10, y: 0, z: 0 }), new XYZ({ x: 10, y: 10, z: 0 })).value;
            const result = factory.wire([e1, e2]);
            expect(result.isOk).toBe(true);
            expect(result.value.shapeType).toBe(ShapeTypes.wire);
        });
    });
});

// ============================================================================
// Faces, shells & solids
// ============================================================================

describe("ShapeFactory — faces, shells & solids", () => {
    describe("face", () => {
        test("should create a face from a single wire", () => {
            const rect = factory.rect(plane, 10, 10).value;
            const outerWire = rect.findSubShapes(ShapeTypes.wire)[0];
            const result = factory.face([outerWire as IWire]);
            expect(result.isOk).toBe(true);
            expect(result.value.shapeType).toBe(ShapeTypes.face);
        });

        test("should return error when wire is empty", () => {
            const result = factory.face([]);
            expect(result.isOk).toBe(false);
            expect(result.error).toBe("The wire is empty.");
        });
    });

    describe("faceFromSurface", () => {
        const sourceRect = () => unwrapOk(factory.rect(plane, 10, 20)) as OccFace;

        test("should create a face on the source plane surface", () => {
            const wire = unwrapOk(
                factory.polygon([
                    XYZ.zero,
                    new XYZ({ x: 4, y: 0, z: 0 }),
                    new XYZ({ x: 4, y: 5, z: 0 }),
                    new XYZ({ x: 0, y: 5, z: 0 }),
                ]),
            );
            const result = factory.faceFromSurface([wire], sourceRect());
            expect(result.isOk).toBe(true);
            const face = result.value as OccFace;
            expect(face.shapeType).toBe(ShapeTypes.face);
            expect(face.area()).toBeCloseTo(20, 6);
            const [, normal] = face.normal(0.5, 0.5);
            expect(normal.z).toBeCloseTo(1, 6);
            expect(surfaceOfFace(face) instanceof OccPlane).toBe(true);
        });

        test("should create a face with a hole from outer and inner wires", () => {
            const outer = unwrapOk(
                factory.polygon([
                    XYZ.zero,
                    new XYZ({ x: 4, y: 0, z: 0 }),
                    new XYZ({ x: 4, y: 5, z: 0 }),
                    new XYZ({ x: 0, y: 5, z: 0 }),
                ]),
            );
            const inner = unwrapOk(
                factory.polygon([
                    new XYZ({ x: 1, y: 1, z: 0 }),
                    new XYZ({ x: 2, y: 1, z: 0 }),
                    new XYZ({ x: 2, y: 3, z: 0 }),
                    new XYZ({ x: 1, y: 3, z: 0 }),
                ]),
            );
            const result = factory.faceFromSurface([outer, inner], sourceRect());
            expect(result.isOk).toBe(true);
            const face = result.value as OccFace;
            // 4*5 outer minus 1*2 hole
            expect(face.area()).toBeCloseTo(16, 6);
            expect(face.findSubShapes(ShapeTypes.wire).length).toBe(2);
        });

        test("should return error when wires are empty", () => {
            const result = factory.faceFromSurface([], sourceRect());
            expect(result.isOk).toBe(false);
            expect(result.error).toBe("The wire is empty.");
        });

        test("should throw when the source face is not an OccShape", () => {
            const wire = unwrapOk(
                factory.polygon([
                    XYZ.zero,
                    new XYZ({ x: 4, y: 0, z: 0 }),
                    new XYZ({ x: 4, y: 5, z: 0 }),
                    new XYZ({ x: 0, y: 5, z: 0 }),
                ]),
            );
            const fakeFace = new MockShape({ shapeType: ShapeTypes.face }) as unknown as IFace;
            expect(() => factory.faceFromSurface([wire], fakeFace)).toThrow(
                "OCC kernel only supports OCC geometries",
            );
        });
    });

    describe("shell", () => {
        test("should create a shell from faces", () => {
            // Create 6 faces of a cube
            const bottom = factory.rect(plane, 10, 10).value;
            const top = factory.rect(
                new Plane({
                    origin: new XYZ({ x: 0, y: 0, z: 10 }),
                    normal: XYZ.unitZ,
                    xvec: XYZ.unitX,
                }),
                10,
                10,
            ).value;
            // Shell from the top and bottom faces of a cube builds successfully
            const result = factory.shell([bottom, top]);
            expect(result.isOk).toBe(true);
        });
    });

    describe("solid", () => {
        test("should create a solid from a closed shell", () => {
            // Create a box then extract its shell
            const box = factory.box(plane, 10, 10, 10).value;
            const shells = box.findSubShapes(ShapeTypes.shell);
            expect(shells.length).toBeGreaterThan(0);
            const result = factory.solid(shells);
            expect(result.isOk).toBe(true);
            expect(result.value.shapeType).toBe(ShapeTypes.solid);
        });
    });
});

// ============================================================================
// Operations (prism, pushPull, revolve, sweep, loft, fuse)
// ============================================================================

describe("ShapeFactory — operations", () => {
    describe("prism", () => {
        test("should extrude a face into a solid", () => {
            const rect = factory.rect(plane, 10, 10).value;
            const result = factory.prism(rect, new XYZ({ x: 0, y: 0, z: 20 }));
            expect(result.isOk).toBe(true);
            expect(result.value.shapeType).toBe(ShapeTypes.solid);
        });

        test("should return error when vector length is zero", () => {
            const boxValue = factory.box(plane, 10, 10, 10).value;
            const result = factory.prism(boxValue, XYZ.zero);
            expect(result.isOk).toBe(false);
            expect(result.error).toContain("vector length is 0");
        });
    });

    describe("pushPull", () => {
        test("should push/pull a face on a solid", () => {
            const box = factory.box(plane, 10, 10, 10).value;
            const faces = box.findSubShapes(ShapeTypes.face);
            expect(faces.length).toBeGreaterThanOrEqual(6);
            // Push/pull on a box face succeeds
            const pushPullResult = factory.pushPull(box, faces[0], new XYZ({ x: 0, y: 0, z: 5 }));
            expect(pushPullResult.isOk).toBe(true);
        });

        test("should return error when vector length is zero", () => {
            const box = factory.box(plane, 10, 10, 10).value;
            const faces = box.findSubShapes(ShapeTypes.face);
            const result = factory.pushPull(box, faces[0], XYZ.zero);
            expect(result.isOk).toBe(false);
        });
    });

    describe("revolve", () => {
        test("should revolve a face around an axis", () => {
            const rect = factory.rect(
                new Plane({
                    origin: new XYZ({ x: 5, y: 0, z: 0 }),
                    normal: XYZ.unitX,
                    xvec: XYZ.unitZ,
                }),
                10,
                20,
            ).value;
            const axis = new Line({ point: XYZ.zero, direction: XYZ.unitZ });
            const result = factory.revolve(rect, axis, 360);
            expect(result.isOk).toBe(true);
            expect(result.value.shapeType).toBe(ShapeTypes.solid);
        });
    });

    describe("sweep", () => {
        test("should return error for non-OccShape profile", () => {
            const fakeShape = new MockShape({ shapeType: ShapeTypes.edge }) as unknown as IShape;
            const pathEdge = factory.line(XYZ.zero, new XYZ({ x: 0, y: 0, z: 10 })).value;
            const pathWire = factory.wire([pathEdge]).value;
            // ensureOccShape throws — verify we get an error
            expect(() => factory.sweep([fakeShape], pathWire, false)).toThrow();
        });

        test.each([
            false,
            true,
        ])("should sweep a circular profile along a straight path (isRound=%s)", (isRound) => {
            const profile = unwrapOk(factory.wire([unwrapOk(factory.circle(XYZ.unitZ, XYZ.zero, 2))]));
            const path = unwrapOk(
                factory.wire([unwrapOk(factory.line(XYZ.zero, new XYZ({ x: 0, y: 0, z: 10 })))]),
            );
            const result = factory.sweep([profile], path, isRound);
            expect(result.isOk).toBe(true);
            const shape = result.value;
            expect(shape.shapeType).toBe(ShapeTypes.solid);
            expect(shape.findSubShapes(ShapeTypes.face).length).toBe(3);
            const solid = shape.findSubShapes(ShapeTypes.solid)[0] as unknown as OccSolid;
            // A radius-2 circle swept 10 along its normal is a cylinder
            expect(solid.volume()).toBeCloseTo(Math.PI * 2 * 2 * 10, 6);
        });

        test.each([
            { isRound: false, faces: 4, volume: Math.PI * 20 },
            { isRound: true, faces: 5, volume: 62.5457 },
        ])("should sweep a profile along an L-shaped path (isRound=$isRound)", ({
            isRound,
            faces,
            volume,
        }) => {
            const profile = unwrapOk(factory.wire([unwrapOk(factory.circle(XYZ.unitZ, XYZ.zero, 1))]));
            const path = unwrapOk(
                factory.wire([
                    unwrapOk(factory.line(XYZ.zero, new XYZ({ x: 0, y: 0, z: 10 }))),
                    unwrapOk(factory.line(new XYZ({ x: 0, y: 0, z: 10 }), new XYZ({ x: 10, y: 0, z: 10 }))),
                ]),
            );
            const result = factory.sweep([profile], path, isRound);
            expect(result.isOk).toBe(true);
            const shape = result.value;
            expect(shape.findSubShapes(ShapeTypes.face).length).toBe(faces);
            const solid = shape.findSubShapes(ShapeTypes.solid)[0] as unknown as OccSolid;
            expect(solid.volume()).toBeCloseTo(volume, 3);
        });
    });

    describe("loft", () => {
        test("should loft between two circles", () => {
            const c1 = factory.circle(XYZ.unitZ, XYZ.zero, 5).value;
            const c2 = factory.circle(XYZ.unitZ, new XYZ({ x: 0, y: 0, z: 20 }), 8).value;
            const result = factory.loft([c1, c2], true, false, "c0");
            expect(result.isOk).toBe(true);
            expect(result.value.shapeType).toBe(ShapeTypes.solid);
        });

        test("should loft as ruled surface", () => {
            const c1 = factory.circle(XYZ.unitZ, XYZ.zero, 5).value;
            const c2 = factory.circle(XYZ.unitZ, new XYZ({ x: 5, y: 5, z: 15 }), 3).value;
            const result = factory.loft([c1, c2], true, true, "c0");
            expect(result.isOk).toBe(true);
        });

        test("should return error when sections are empty", () => {
            const result = factory.loft([], true, false, "c0");
            expect(result.isOk).toBe(false);
            expect(result.error).toBe("Failed to loft: at least 2 sections are required");
        });

        test("should throw when a section is not an OccShape", () => {
            const fakeSection = new MockShape({ shapeType: ShapeTypes.wire }) as unknown as IWire;
            expect(() => factory.loft([fakeSection], true, false, "c0")).toThrow(
                "The OCC kernel only supports OCC geometries.",
            );
        });
    });

    describe("fuse", () => {
        test("should fuse two shapes", () => {
            const box1 = factory.box(plane, 10, 10, 10).value;
            const box2 = factory.box(shiftedPlane, 10, 10, 10).value;
            const result = factory.fuse(box1, box2);
            expect(result.isOk).toBe(true);
        });
    });
});

// ============================================================================
// Boolean operations
// ============================================================================

describe("ShapeFactory — boolean operations", () => {
    test("booleanFuse should merge two boxes (no simplify)", () => {
        const box1 = factory.box(plane, 10, 10, 10).value;
        const box2 = factory.box(shiftedPlane, 10, 10, 10).value;
        const result = factory.booleanFuse([box1], [box2], false);
        expect(result.isOk).toBe(true);
    });

    test("booleanFuse should merge two boxes with simplify", () => {
        const box1 = factory.box(plane, 10, 10, 10).value;
        const box2 = factory.box(shiftedPlane, 10, 10, 10).value;
        const result = factory.booleanFuse([box1], [box2], true);
        expect(result.isOk).toBe(true);
    });

    test("booleanCommon should compute intersection", () => {
        const box1 = factory.box(plane, 10, 10, 10).value;
        const box2 = factory.box(shiftedPlane, 10, 10, 10).value;
        const result = factory.booleanCommon([box1], [box2]);
        expect(result.isOk).toBe(true);
    });

    test("booleanCut should cut one box from another", () => {
        const box1 = factory.box(plane, 10, 10, 10).value;
        const box2 = factory.box(shiftedPlane, 10, 10, 10).value;
        const result = factory.booleanCut([box1], [box2]);
        expect(result.isOk).toBe(true);
    });
});

// ============================================================================
// Feature operations
// ============================================================================

describe("ShapeFactory — feature operations", () => {
    describe("fillet", () => {
        test("should apply fillet on box edges", () => {
            const box = factory.box(plane, 10, 10, 10).value;
            const result = factory.fillet(box, [0, 1, 2, 3], 1);
            expect(result.isOk).toBe(true);
        });

        test("should return error when radius is too small", () => {
            const boxValue = factory.box(plane, 10, 10, 10).value;
            const result = factory.fillet(boxValue, [0], 0);
            expect(result.isOk).toBe(false);
            expect(result.error).toBe("The radius is too small.");
        });

        test("should return error when edges is empty", () => {
            const boxValue = factory.box(plane, 10, 10, 10).value;
            const result = factory.fillet(boxValue, [], 5);
            expect(result.isOk).toBe(false);
            expect(result.error).toBe("The edges is empty.");
        });

        test("should return error when shape is not OccShape", () => {
            const fakeShape = new MockShape({ shapeType: ShapeTypes.edge }) as unknown as IShape;
            const result = factory.fillet(fakeShape, [0], 5);
            expect(result.isOk).toBe(false);
            expect(result.error).toBe("Not OccShape");
        });

        test("should catch WASM error on invalid edge index", () => {
            const boxValue = factory.box(plane, 10, 10, 10).value;
            const result = factory.fillet(boxValue, [999], 5);
            expect(result.isOk).toBe(false);
            expect(result.error).toContain("Fillet Error");
        });
    });

    describe("chamfer", () => {
        test("should apply chamfer on box edges", () => {
            const box = factory.box(plane, 10, 10, 10).value;
            const result = factory.chamfer(box, [0, 1, 2, 3], 1);
            expect(result.isOk).toBe(true);
        });

        test("should return error when distance is too small", () => {
            const boxValue = factory.box(plane, 10, 10, 10).value;
            const result = factory.chamfer(boxValue, [0], 0);
            expect(result.isOk).toBe(false);
            expect(result.error).toBe("The distance is too small.");
        });

        test("should return error when edges is empty", () => {
            const boxValue = factory.box(plane, 10, 10, 10).value;
            const result = factory.chamfer(boxValue, [], 5);
            expect(result.isOk).toBe(false);
            expect(result.error).toBe("The edges is empty.");
        });

        test("should return error when shape is not OccShape", () => {
            const fakeShape = new MockShape({ shapeType: ShapeTypes.solid }) as unknown as IShape;
            const result = factory.chamfer(fakeShape, [0], 5);
            expect(result.isOk).toBe(false);
            expect(result.error).toBe("Not OccShape");
        });

        test("should catch WASM error on invalid edge index", () => {
            const boxValue = factory.box(plane, 10, 10, 10).value;
            const result = factory.chamfer(boxValue, [999], 5);
            expect(result.isOk).toBe(false);
            expect(result.error).toContain("Chamfer Error");
        });
    });

    describe("removeFillet", () => {
        test("should return error when shape is not OccShape", () => {
            const fakeShape = new MockShape({ shapeType: ShapeTypes.solid }) as unknown as IShape;
            const result = factory.removeFillet(fakeShape, []);
            expect(result.isOk).toBe(false);
            expect(result.error).toBe("Not OccShape");
        });

        test("should remove fillet faces and restore the original box", () => {
            const box = unwrapOk(factory.box(plane, 10, 10, 10));
            const boxVolume = (box.findSubShapes(ShapeTypes.solid)[0] as unknown as OccSolid).volume();
            expect(boxVolume).toBeCloseTo(1000, 6);

            const filleted = unwrapOk(factory.fillet(box, [0, 1, 2, 3], 1));
            const filletedVolume = (
                filleted.findSubShapes(ShapeTypes.solid)[0] as unknown as OccSolid
            ).volume();
            expect(filletedVolume).toBeLessThan(boxVolume);

            const filletFaces = filleted
                .findSubShapes(ShapeTypes.face)
                .map((f) => f as OccFace)
                .filter((f) => surfaceOfFace(f) instanceof OccCylindricalSurface);
            expect(filletFaces.length).toBe(4);

            const { shape, newEdges } = unwrapOk(factory.removeFillet(filleted, filletFaces));
            const restoredVolume = (shape.findSubShapes(ShapeTypes.solid)[0] as unknown as OccSolid).volume();
            expect(restoredVolume).toBeCloseTo(boxVolume, 6);
            expect(shape.findSubShapes(ShapeTypes.face).length).toBe(6);
            expect(newEdges.length).toBe(16);
        });
    });

    describe("removeSubShape", () => {
        test("should remove a sub-shape", () => {
            const box = factory.box(plane, 10, 10, 10).value;
            const edges = box.findSubShapes(ShapeTypes.edge);
            expect(edges.length).toBeGreaterThan(0);
            // Removing one edge of a box succeeds
            const removeSubResult = factory.removeSubShape(box, [edges[0]]);
            expect(removeSubResult.isOk).toBe(true);
        });
    });

    describe("replaceSubShape", () => {
        test("should replace a sub-shape", () => {
            const box = factory.box(plane, 10, 10, 10).value;
            const edges = box.findSubShapes(ShapeTypes.edge);
            // Replacing one edge of a box with another succeeds
            const replaceResult = factory.replaceSubShapes(box, [edges[0]], [edges[1]]);
            expect(replaceResult.isOk).toBe(true);
        });
    });
});

// ============================================================================
// Advanced operations
// ============================================================================

describe("ShapeFactory — advanced operations", () => {
    describe("combine", () => {
        test("should combine multiple shapes into a compound", () => {
            const box1 = factory.box(plane, 5, 5, 5).value;
            const box2 = factory.box(
                new Plane({
                    origin: new XYZ({ x: 20, y: 0, z: 0 }),
                    normal: XYZ.unitZ,
                    xvec: XYZ.unitX,
                }),
                5,
                5,
                5,
            ).value;
            const result = factory.combine([box1, box2]);
            expect(result.isOk).toBe(true);
            expect(result.value.shapeType).toBe(ShapeTypes.compound);
        });
    });

    describe("sewing", () => {
        test("should handle sewing two shapes", () => {
            // Sewing two boxes succeeds
            const box1 = factory.box(plane, 10, 10, 10).value;
            const box2 = factory.box(shiftedPlane, 10, 10, 10).value;
            const sewResult = factory.sewing([box1, box2]);
            expect(sewResult.isOk).toBe(true);
        });
    });

    describe("makeThickSolidBySimple", () => {
        test("should create a thick solid (hollow box)", () => {
            const rect = factory.rect(plane, 10, 10).value;
            const thickResult = factory.makeThickSolidBySimple(rect, 1);
            expect(thickResult.isOk).toBe(true);
        });
    });

    describe("makeThickSolidByJoin", () => {
        test("should create a thick solid with closing faces", () => {
            const box = factory.box(plane, 10, 10, 10).value;
            const faces = box.findSubShapes(ShapeTypes.face);
            // Thickening a box by joining on one face succeeds
            const thickJoinResult = factory.makeThickSolidByJoin(box, [faces[0] as IFace], 0.5);
            expect(thickJoinResult.isOk).toBe(true);
        });
    });

    describe("curveProjection", () => {
        test("should project a curve onto a face", () => {
            const box = factory.box(plane, 10, 10, 10).value;
            const topFace = box.findSubShapes(ShapeTypes.face)[4]; // typically top face
            const curve = factory.line(XYZ.zero, new XYZ({ x: 10, y: 0, z: 0 })).value;
            // Projecting a line onto a box face along Z succeeds
            const projResult = factory.curveProjection(curve, topFace as IFace, XYZ.unitZ);
            expect(projResult.isOk).toBe(true);
        });
    });

    describe("simplifyShape", () => {
        test("should simplify a shape", () => {
            const box = factory.box(plane, 10, 10, 10).value;
            const result = factory.simplifyShape(box, true, true, [], 1e-5, 1e-5);
            expect(result.isOk).toBe(true);
        });
    });
});

// ============================================================================
// Error catching (convertShapeResult coverage)
// ============================================================================

describe("ShapeFactory — convertShapeResult error catching", () => {
    test("should return error when WASM throws on fillet with invalid edge", () => {
        const boxValue = factory.box(plane, 10, 10, 10).value;
        const result = factory.fillet(boxValue, [999], 5);
        expect(result.isOk).toBe(false);
        expect(result.error).toContain("Fillet Error");
    });

    test("should return error when WASM throws on chamfer with invalid edge", () => {
        const boxValue = factory.box(plane, 10, 10, 10).value;
        const result = factory.chamfer(boxValue, [999], 5);
        expect(result.isOk).toBe(false);
        expect(result.error).toContain("Chamfer Error");
    });

    test("should throw error on removeSubShape with non-OccShape", () => {
        const fakeShape = new MockShape({ shapeType: ShapeTypes.solid }) as unknown as IShape;
        expect(() => factory.removeSubShape(fakeShape, [])).toThrow(
            "OCC kernel only supports OCC geometries",
        );
    });

    test("should throw error on ensureOccShape with single non-OccShape", () => {
        const fakeShape = new MockShape({ shapeType: ShapeTypes.solid }) as unknown as IShape;
        expect(() => factory.prism(fakeShape, new XYZ({ x: 1, y: 0, z: 0 }))).toThrow(
            "OCC kernel only supports OCC geometries",
        );
    });
});

// ============================================================================
// edge() method
// ============================================================================

describe("ShapeFactory — edge from curve", () => {
    test("should create edge from OccCurve", () => {
        const lineEdge = factory.line(XYZ.zero, XYZ.unitX).value;
        const curve = (lineEdge as OccEdge).curve;
        const edge = factory.edge(curve);
        expect(edge).toBeDefined();
        expect(edge.shapeType).toBe(ShapeTypes.edge);
    });

    test("should throw error when curve is not OccCurve", () => {
        const fakeCurve = { curveType: "line" } as any;
        expect(() => factory.edge(fakeCurve)).toThrow("Invalid curve");
    });
});

// ============================================================================
// removeFeature
// ============================================================================

describe("ShapeFactory — removeFeature", () => {
    test("should return error when shape is not OccShape", () => {
        const fakeShape = new MockShape({ shapeType: ShapeTypes.solid }) as unknown as IShape;
        const result = factory.removeFeature(fakeShape, []);
        expect(result.isOk).toBe(false);
        expect(result.error).toBe("Not OccShape");
    });

    test("should remove a fused boss and restore the base box", () => {
        const base = unwrapOk(factory.box(plane, 20, 20, 10));
        const boss = unwrapOk(
            factory.box(
                new Plane({
                    origin: new XYZ({ x: 5, y: 5, z: 10 }),
                    normal: XYZ.unitZ,
                    xvec: XYZ.unitX,
                }),
                5,
                5,
                5,
            ),
        );
        const fused = unwrapOk(factory.booleanFuse([base], [boss], true));
        const fusedSolid = fused.findSubShapes(ShapeTypes.solid)[0] as unknown as OccSolid;
        expect(fusedSolid.volume()).toBeCloseTo(4125, 6);

        // The boss contributes 5 faces of area 25 (4 sides + top)
        const bossFaces = fusedSolid
            .findSubShapes(ShapeTypes.face)
            .map((f) => f as OccFace)
            .filter((f) => Math.abs(f.area() - 25) < 1e-6);
        expect(bossFaces.length).toBe(5);

        const restored = unwrapOk(factory.removeFeature(fusedSolid, bossFaces));
        const restoredSolid = restored.findSubShapes(ShapeTypes.solid)[0] as unknown as OccSolid;
        expect(restoredSolid.volume()).toBeCloseTo(4000, 6);
        expect(restored.findSubShapes(ShapeTypes.face).length).toBe(6);
    });
});

// ============================================================================
// removeFillet — additional paths
// ============================================================================

describe("ShapeFactory — removeFillet additional", () => {
    test("should handle removeFillet on box with zero edges", () => {
        const box = factory.box(plane, 10, 10, 10).value;
        // A box has no fillets — nothing can be removed, so this returns an error
        const result = factory.removeFillet(box, []);
        expect(result.isOk).toBe(false);
        expect(result.error).toBe("Failed to remove fillet");
    });
});

// ============================================================================
// loft — edge sections (edge→wire conversion)
// ============================================================================

describe("ShapeFactory — loft with edge sections", () => {
    test("should loft with edge sections (auto wire conversion)", () => {
        const e1 = factory.circle(XYZ.unitZ, XYZ.zero, 5).value;
        const e2 = factory.circle(XYZ.unitZ, new XYZ({ x: 0, y: 0, z: 20 }), 8).value;
        // Pass edges directly — loft should convert them to wires
        const result = factory.loft([e1, e2], true, false, "c0");
        expect(result.isOk).toBe(true);
        expect(result.value.shapeType).toBe(ShapeTypes.solid);
    });

    test("should loft with mixed edge and wire sections", () => {
        const edge = factory.circle(XYZ.unitZ, XYZ.zero, 5).value;
        const c2 = factory.circle(XYZ.unitZ, new XYZ({ x: 0, y: 0, z: 20 }), 8).value;
        const wire = factory.wire([c2]).value;
        const result = factory.loft([edge, wire], true, false, "c0");
        expect(result.isOk).toBe(true);
    });
});
