// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import type { IDocument, IEdge, IWire } from "@chili3d/core";
import { Result } from "@chili3d/core";
import { createMockDocument } from "@chili3d/core/test-utils";
import { beforeEach, describe, expect, rs, test } from "@rstest/core";
import { FaceNode } from "../../src/bodys/face";
import { createMockEdge, createMockShape, createMockWire, setupShapeFactoryMock } from "./_utils";

describe("FaceNode", () => {
    let doc: IDocument;

    beforeEach(() => {
        doc = createMockDocument();
    });

    describe("constructor", () => {
        test("should initialize shapes", () => {
            const edge = createMockEdge();
            const wire = createMockWire();
            const shapes = [edge, wire] as any;
            const node = new FaceNode({ document: doc, shapes });
            expect(node.shapes).toBe(shapes);
        });

        test("should set name from display()", () => {
            const node = new FaceNode({ document: doc, shapes: [createMockEdge()] as any });
            expect(node.name).toBe("body.face");
        });

        test("should accept empty shapes array", () => {
            const node = new FaceNode({ document: doc, shapes: [] });
            expect(node.shapes.length).toBe(0);
        });
    });

    describe("display", () => {
        test("should return body.face", () => {
            const node = new FaceNode({ document: doc, shapes: [createMockEdge()] as any });
            expect(node.display()).toBe("body.face");
        });
    });

    describe("getters", () => {
        test("should return shapes from constructor", () => {
            const wire = createMockWire();
            const node = new FaceNode({ document: doc, shapes: [wire] as any });
            expect(node.shapes[0]).toBe(wire);
        });
    });

    describe("setters", () => {
        test("setting shapes should update value", () => {
            const mockFace = createMockShape();
            setupShapeFactoryMock({
                wire: () => Result.ok(createMockWire()),
                face: () => Result.ok(mockFace),
            });
            const node = new FaceNode({ document: doc, shapes: [createMockEdge()] as any });
            const newShapes = [createMockWire(), createMockEdge({ isClosed: () => true })] as any;
            node.shapes = newShapes;
            expect(node.shapes).toBe(newShapes);
        });
    });

    describe("onPropertyChanged", () => {
        test("should emit when shapes change", () => {
            const mockFace = createMockShape();
            setupShapeFactoryMock({
                wire: () => Result.ok(createMockWire()),
                face: () => Result.ok(mockFace),
            });
            const node = new FaceNode({ document: doc, shapes: [createMockEdge()] as any });
            const handler = rs.fn((_property: string) => {});
            node.onPropertyChanged(handler);
            node.shapes = [createMockWire()] as any;
            expect(handler.mock.calls.map((c) => c[0])).toContain("shapes");
        });
    });

    describe("generateShape", () => {
        test("should return error when shapes is empty", () => {
            const node = new FaceNode({ document: doc, shapes: [] });
            const result = node.generateShape();
            expect(result.isOk).toBe(false);
        });

        test("should call shapeFactory.wire and shapeFactory.face for closed edges", () => {
            const mockWire = createMockWire();
            const faceShape = createMockShape();
            const wire = rs.fn((_edges: IEdge[]) => Result.ok(mockWire));
            const face = rs.fn((_wires: IWire[]) => Result.ok(faceShape));
            setupShapeFactoryMock({ wire, face });
            const node = new FaceNode({
                document: doc,
                shapes: [createMockEdge({ isClosed: () => true })] as any,
            });
            const result = node.generateShape();
            expect(result.isOk).toBe(true);
            expect(wire).toHaveBeenCalledTimes(1);
            expect(wire.mock.calls[0][0].length).toBe(1);
            expect(face).toHaveBeenCalledTimes(1);
            expect(face.mock.calls[0][0].length).toBe(1);
        });

        test("should use wire shapes directly without creating new wire", () => {
            const mockWire = createMockWire();
            const face = rs.fn((_wires: IWire[]) => Result.ok(createMockShape()));
            setupShapeFactoryMock({ face });
            const node = new FaceNode({ document: doc, shapes: [mockWire] as any });
            const result = node.generateShape();
            expect(result.isOk).toBe(true);
            expect(face).toHaveBeenCalledTimes(1);
            expect(face.mock.calls[0][0].length).toBe(1);
        });

        test("should throw error when wire from unclosed edges fails", () => {
            setupShapeFactoryMock({
                wire: () => Result.err("cannot create wire"),
            });
            const node = new FaceNode({
                document: doc,
                shapes: [createMockEdge({ isClosed: () => false })] as any,
            });
            expect(() => node.generateShape()).toThrow("Cannot create wire from open shapes");
        });
    });
});
