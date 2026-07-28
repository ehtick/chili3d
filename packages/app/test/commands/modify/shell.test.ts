// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { Matrix4, Result, ShapeTypes } from "@chili3d/core";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "@rstest/core";
import { ShellCommand } from "../../../src/commands/modify/shell";
import {
    ensureGlobalStubApp,
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
 * Build a shell command with the two required steps seeded:
 *   step 0 → a solid-like node whose `owner.node` is a ShapeNode-ish stub
 *   step 1 → the open faces to remove (each entry becomes one IFace)
 * Returns the command plus the node's tracking parent so callers can assert
 * what was added / removed from the document tree.
 */
function buildShellCommand(faceCount = 2) {
    const cmd = new ShellCommand();
    const { doc } = wireCommand(cmd);

    const shape = mockShape();
    const parent = doc.modelManager.rootNode as unknown as TrackingParent;
    const solidNode = {
        name: "solid0",
        shape: { value: shape },
        transform: Matrix4.identity(),
        materialId: "mat-1",
        parent,
        previousSibling: undefined,
        nextSibling: undefined,
    };

    const step0 = shapeStepResult([{ node: solidNode }]);
    // shapeStepResult assigns its own parent; repoint the node to ours.
    (step0.shapes[0].owner as any).node = solidNode;
    (step0.shapes[0].owner as any).getNode = () => solidNode;

    const faces = Array.from({ length: faceCount }, (_, index) => mockShape({ id: `face-${index}` }) as any);
    const step1 = shapeStepResult(faces.map((shape) => ({ shape })));

    seedStepDatas(cmd, [step0, step1]);
    return { cmd, parent, shape, solidNode, faces, doc };
}

describe("ShellCommand", () => {
    let restoreTx: () => void;
    beforeEach(() => {
        restoreTx = stubTransactionRun();
    });
    afterEach(() => restoreTx());

    test("should have command metadata", () => {
        const data = (ShellCommand as any).prototype.data;
        expect(data).not.toBeNull();
        expect(data.key).toBe("modify.shell");
        expect(data.icon).toBe("icon-shell");
    });

    test("thickness should default to 1", () => {
        const cmd = new ShellCommand();
        expect(cmd.thickness).toBe(1);
    });

    test("thickness setter should update property", () => {
        const cmd = new ShellCommand();
        cmd.thickness = 5;
        expect(cmd.thickness).toBe(5);
    });

    test("getSteps should return two steps", () => {
        const cmd = new ShellCommand();
        const steps = (cmd as any).getSteps();
        expect(steps.length).toBe(2);
    });

    test("first step shape filter should only allow solid-like shapes", () => {
        const cmd = new ShellCommand();
        const steps = (cmd as any).getSteps();
        const allow = steps[0].options.shapeFilter.allow;
        expect(allow({ shapeType: ShapeTypes.solid })).toBe(true);
        expect(allow({ shapeType: ShapeTypes.compound })).toBe(true);
        expect(allow({ shapeType: ShapeTypes.compoundSolid })).toBe(true);
        expect(allow({ shapeType: ShapeTypes.face })).toBe(false);
        expect(allow({ shapeType: ShapeTypes.edge })).toBe(false);
    });

    describe("executeMainTask", () => {
        test("should add the shelled EditableShapeNode and remove the original node", () => {
            const { cmd, parent, doc } = buildShellCommand();

            (cmd as any).executeMainTask();

            expect(parent.added).toHaveLength(1);
            expect(parent.removed).toHaveLength(1);
            expect(parent.removed[0]).toBe((cmd as any).stepDatas[0].shapes[0].owner.node);

            const added = parent.added[0] as any;
            expect(added.name).toBe("solid0");
            expect(added.materialId).toBe("mat-1");
            expect(doc.visual.update).toHaveBeenCalled();
        });

        test("should fall back to rootNode when the original node has no parent", () => {
            const { cmd, solidNode, parent } = buildShellCommand(1);
            // Detach the node so `node.parent ?? rootNode` is exercised.
            (solidNode as any).parent = undefined;

            (cmd as any).executeMainTask();

            expect(parent.added).toHaveLength(1);
        });

        test("should pass the selected faces and thickness to shapeFactory.makeThickSolidByJoin", () => {
            const { cmd, shape } = buildShellCommand(3);
            cmd.thickness = 2.5;

            const provider = (globalThis as any).app.shapeProvider;
            const original = provider.factory;
            const calls: any[] = [];
            Object.defineProperty(provider, "factory", {
                configurable: true,
                value: new Proxy(
                    {},
                    {
                        get:
                            (_t, prop) =>
                            (...args: any[]) => {
                                if (prop === "makeThickSolidByJoin") calls.push(args);
                                return mockShape();
                            },
                    },
                ),
            });

            try {
                (cmd as any).executeMainTask();
                expect(calls).toHaveLength(1);
                expect(calls[0][0]).toBe(shape); // the original solid
                expect(calls[0][1]).toHaveLength(3); // the selected open faces
                expect(calls[0][2]).toBe(2.5); // thickness is the 3rd arg
                expect(calls[0][1].map((x: any) => x.id)).toEqual(["face-0", "face-1", "face-2"]);
            } finally {
                Object.defineProperty(provider, "factory", {
                    configurable: true,
                    value: original,
                });
            }
        });

        test("should not modify the document when the shell operation fails", () => {
            const { cmd, parent, doc } = buildShellCommand();

            const provider = (globalThis as any).app.shapeProvider;
            const original = provider.factory;
            Object.defineProperty(provider, "factory", {
                configurable: true,
                value: new Proxy(
                    {},
                    {
                        get:
                            (_t, prop) =>
                            (..._args: any[]) => {
                                if (prop === "makeThickSolidByJoin") return Result.err("shell failed");
                                return mockShape();
                            },
                    },
                ),
            });

            try {
                (cmd as any).executeMainTask();
                expect(parent.added).toHaveLength(0);
                expect(parent.removed).toHaveLength(0);
                expect(doc.visual.update).not.toHaveBeenCalled();
            } finally {
                Object.defineProperty(provider, "factory", {
                    configurable: true,
                    value: original,
                });
            }
        });
    });
});
