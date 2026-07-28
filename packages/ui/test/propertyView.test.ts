// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

// test-utils must load BEFORE the core-mock helper so the real core module is
// fully cached by the time `rs.mock("@chili3d/core")` registers.
import { createMockDocument } from "@chili3d/core/test-utils";
import { describe, expect, test } from "@rstest/core";

// ============================================================
// Mocks setup — must come before imports of the module under test
// ============================================================

// CSS modules — shared ones via helper, file-specific one inline
import "./_helpers/cssMocks";

rs.mock("../src/property/propertyView.module.css", () => ({
    root: "pv-root",
    panel: "pv-panel",
    header: "pv-header",
    properties: "pv-properties",
}));

// Element helpers
import "./_helpers/mockElement";

// Core mock with PubSub recorder + PropertyUtils / Node-marker stubs
import { pubSubRecorder } from "./_helpers/mockCorePropertyView";

// Mock property control helpers to return simple DOM elements
rs.mock("../src/property/complexPropertyUtils", () => ({
    propertyControl: () => {
        const el = document.createElement("div");
        el.className = "mock-property-control";
        el.textContent = "property";
        return el;
    },
}));

rs.mock("../src/property/matrixProperty", () => ({
    MatrixProperty: class extends HTMLElement {
        constructor(_doc: unknown, _geos: unknown, _cls: string) {
            super();
            this.textContent = "matrix";
        }
    },
}));

// Now import the module under test
import { type INode, Node } from "@chili3d/core";
import { PropertyView } from "../src/property/propertyView";
import { mustQuery } from "./_helpers/domHelpers";

// TestNode extends the mocked Node marker class, so it hits the
// `nodes[0] instanceof Node` branch of PropertyView.addModel.
class TestNode extends (Node as unknown as new () => object) {
    name = "test";
    color = "#ff0000";
    display() {
        return "TestNode";
    }
}

describe("PropertyView", () => {
    beforeEach(() => {
        pubSubRecorder.reset();
    });

    describe("constructor", () => {
        test("should create with header label", () => {
            const pv = new PropertyView({ className: "test-panel" });

            const labels = pv.querySelectorAll("label");
            expect(labels.length).toBe(1);
            expect(labels[0].className).toBe("pv-header");
        });

        test("should apply provided className and root style", () => {
            const pv = new PropertyView({ className: "test-panel" });

            expect(pv.className).toContain("test-panel");
            expect(pv.className).toContain("pv-root");
        });

        test("should subscribe to showProperties event", () => {
            new PropertyView({ className: "test-panel" });

            expect(pubSubRecorder.handlers.has("showProperties")).toBe(true);
        });

        test("should subscribe to activeViewChanged event", () => {
            new PropertyView({ className: "test-panel" });

            expect(pubSubRecorder.handlers.has("activeViewChanged")).toBe(true);
        });

        test("should create panel element", () => {
            const pv = new PropertyView({ className: "test-panel" });

            mustQuery(pv, '[class*="panel"]');
        });
    });

    describe("handleShowProperties", () => {
        test("should clear existing properties when called with empty nodes", () => {
            const pv = new PropertyView({ className: "test-panel" });
            const doc = createMockDocument();
            const handler = pubSubRecorder.handlers.get("showProperties");
            expect(handler).toBeDefined();

            // Populate the panel first, then clear it with an empty selection
            handler!(doc, [new TestNode() as unknown as INode]);
            const panel = mustQuery(pv, ".pv-panel");
            expect(panel.childElementCount).toBe(1);

            handler!(doc, []);
            expect(panel.childElementCount).toBe(0);
        });

        test("should render property controls for a Node", () => {
            const pv = new PropertyView({ className: "test-panel" });
            const doc = createMockDocument();
            const handler = pubSubRecorder.handlers.get("showProperties");
            expect(handler).toBeDefined();

            handler!(doc, [new TestNode() as unknown as INode]);

            // addModel maps the mocked own properties through the propertyControl mock
            const controls = pv.querySelectorAll(".pv-panel .mock-property-control");
            expect(controls.length).toBe(1);
        });

        test("should handle empty nodes gracefully", () => {
            const pv = new PropertyView({ className: "test-panel" });
            const doc = createMockDocument();
            const handler = pubSubRecorder.handlers.get("showProperties");
            expect(handler).toBeDefined();

            handler!(doc, []);

            expect(mustQuery(pv, ".pv-panel").childElementCount).toBe(0);
        });
    });

    describe("handleActiveViewChanged", () => {
        test("should ignore an undefined view", () => {
            const pv = new PropertyView({ className: "test-panel" });
            const handler = pubSubRecorder.handlers.get("activeViewChanged");
            expect(handler).toBeDefined();

            handler!(undefined);

            expect(mustQuery(pv, ".pv-panel").childElementCount).toBe(0);
        });

        test("should show properties of the selected nodes of the new view", () => {
            const pv = new PropertyView({ className: "test-panel" });
            const mockNodes = [new TestNode() as unknown as INode];
            const doc = createMockDocument({
                selection: { getSelectedNodes: () => mockNodes },
            });
            const handler = pubSubRecorder.handlers.get("activeViewChanged");
            expect(handler).toBeDefined();

            // Triggers handleShowProperties internally
            handler!({ document: doc });

            const controls = pv.querySelectorAll(".pv-panel .mock-property-control");
            expect(controls.length).toBe(1);
        });
    });

    describe("isAllElementsOfTypeFirstElement", () => {
        test("should return true for empty array", () => {
            const pv = new PropertyView({ className: "test-panel" });
            // biome-ignore lint/suspicious/noExplicitAny: accessing private method for testing
            expect((pv as any).isAllElementsOfTypeFirstElement([])).toBe(true);
        });

        test("should return true for single element array", () => {
            const pv = new PropertyView({ className: "test-panel" });
            // biome-ignore lint/suspicious/noExplicitAny: accessing private method for testing
            expect((pv as any).isAllElementsOfTypeFirstElement([{ name: "x" }])).toBe(true);
        });

        test("should return true when all elements have same constructor", () => {
            const pv = new PropertyView({ className: "test-panel" });
            class Same {}
            const arr = [new Same(), new Same(), new Same()];
            // biome-ignore lint/suspicious/noExplicitAny: accessing private method for testing
            expect((pv as any).isAllElementsOfTypeFirstElement(arr)).toBe(true);
        });

        test("should return false when elements have different constructors", () => {
            const pv = new PropertyView({ className: "test-panel" });
            class A {}
            class B {}
            const arr = [new A(), new B()];
            // biome-ignore lint/suspicious/noExplicitAny: accessing private method for testing
            expect((pv as any).isAllElementsOfTypeFirstElement(arr)).toBe(false);
        });

        test("should return false when first two items same but third different", () => {
            const pv = new PropertyView({ className: "test-panel" });
            class A {}
            class B {}
            const arr = [new A(), new A(), new B()];
            // biome-ignore lint/suspicious/noExplicitAny: accessing private method for testing
            expect((pv as any).isAllElementsOfTypeFirstElement(arr)).toBe(false);
        });

        test("should return true for two identical items", () => {
            const pv = new PropertyView({ className: "test-panel" });
            class Same {}
            const arr = [new Same(), new Same()];
            // biome-ignore lint/suspicious/noExplicitAny: accessing private method for testing
            expect((pv as any).isAllElementsOfTypeFirstElement(arr)).toBe(true);
        });
    });
});
