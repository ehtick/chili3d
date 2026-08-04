// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    CurveUtils,
    command,
    EditableShapeNode,
    I18n,
    type ICircle,
    type ICurve,
    type IEdge,
    type ILine,
    type IShape,
    type IShapeFilter,
    type ISubEdgeShape,
    MultistepCommand,
    Precision,
    PubSub,
    Result,
    SelectShapeStep,
    type ShapeNode,
    ShapeTypes,
    Transaction,
    type VisualShapeData,
    type XYZ,
} from "@chili3d/core";
import { type OrderedCorner, orderCornerEdges, replaceShapeNode } from "./edgeCornerCommand";

/** The parameters of the point where two support curves meet, one per curve. */
interface Corner {
    p1: number;
    p2: number;
}

/**
 * The support curve of an edge: the unwrapped basis curve (a line or a
 * circle) and the edge's parameter range on it. `period` is 2π for a circle
 * and 0 for an (unbounded) line.
 */
interface SupportCurve {
    curve: ICurve;
    first: number;
    last: number;
    period: number;
    /** The point at a parameter of the basis curve. */
    value(u: number): XYZ;
}

/** The support curve of an edge; undefined when the edge is neither straight nor an arc. */
function supportCurve(edge: IEdge): SupportCurve | undefined {
    const curve = edge.curve;
    const basis = CurveUtils.isTrimmed(curve) ? curve.basisCurve : curve;
    const range = {
        first: curve.firstParameter(),
        last: curve.lastParameter(),
        value: (u: number) => curve.value(u),
    };
    if (CurveUtils.isLine(basis)) return { curve: basis, ...range, period: 0 };
    if (CurveUtils.isCircle(basis)) return { curve: basis, ...range, period: 2 * Math.PI };
    return undefined;
}

/**
 * The corner of two support lines, solved like the 2D corner of the
 * fillet/chamfer operations (see computeCornerPlane in cpp/src/factory.cpp):
 * the intersection of the support lines, which need not lie on the edges
 * themselves.
 */
function lineIntersection(s1: SupportCurve, s2: SupportCurve): Result<Corner> {
    if (!CurveUtils.isLine(s1.curve) || !CurveUtils.isLine(s2.curve)) {
        return Result.err("Edges must be straight lines or arcs");
    }

    // OCCT line directions are unit vectors
    const d1 = s1.curve.direction.normalize()!;
    const d2 = s2.curve.direction.normalize()!;
    const normal = d1.cross(d2);
    const denom = normal.dot(normal);
    if (denom < Precision.Float) {
        return Result.err("Edges must not be parallel");
    }

    const p12 = s2.value(s2.first).sub(s1.value(s1.first));
    if (Math.abs(p12.dot(normal)) > Precision.Distance * Math.sqrt(denom)) {
        return Result.err("Edges must be coplanar");
    }

    return Result.ok({
        p1: s1.first + p12.cross(d2).dot(normal) / denom,
        p2: s2.first + p12.cross(d1).dot(normal) / denom,
    });
}

/** Distance of a parameter outside the edge's current range (0 when inside). */
function distanceOutside(p: number, support: SupportCurve): number {
    return p < support.first ? support.first - p : p > support.last ? p - support.last : 0;
}

/** The representative of p (modulo the period) closest to the edge's current range. */
function normalizeToRange(p: number, support: SupportCurve): number {
    if (support.period === 0) return p;

    let best = p;
    for (const k of [-1, 1]) {
        const candidate = p + k * support.period;
        if (distanceOutside(candidate, support) < distanceOutside(best, support)) best = candidate;
    }
    return best;
}

/**
 * A temporary edge spanning the full extendable range of the support curve:
 * a whole period for a circle; for a line, a span covering the other circle's
 * reach, since the intersection of a line and a circle lies within the
 * circle's projection onto the line.
 */
function maximalEdge(edge: IEdge, support: SupportCurve, other: SupportCurve): IEdge {
    if (support.period > 0) {
        return edge.trim(support.first, support.first + support.period);
    }

    // two lines are solved analytically, so `other` is always a circle here
    const line = support.curve as ILine;
    const circle = other.curve as ICircle;
    const direction = line.direction.normalize()!;
    const centerParameter = support.first + circle.center.sub(support.value(support.first)).dot(direction);
    const margin = circle.radius * 1e-3;
    return edge.trim(
        Math.min(support.first, centerParameter - circle.radius - margin),
        Math.max(support.last, centerParameter + circle.radius + margin),
    );
}

/** A candidate intersection of two support curves: the corner parameters and the point itself. */
interface IntersectionCandidate extends Corner {
    point: XYZ;
}

/**
 * Distance from an intersection point to an edge: 0 when it already lands on
 * the edge, otherwise the distance to the nearest endpoint.
 */
function endpointDistance(p: number, point: XYZ, support: SupportCurve): number {
    if (p >= support.first && p <= support.last) return 0;
    return point.distanceTo(support.value(p < support.first ? support.first : support.last));
}

/**
 * The corner of two support curves of which at least one is a circle, found
 * by intersecting the maximal edges. A line and a circle or two circles can
 * meet twice; the intersection geometrically nearest to the two edges is
 * kept (the same "nearest intersection" rule AutoCAD applies).
 */
function curveIntersection(edge1: IEdge, s1: SupportCurve, edge2: IEdge, s2: SupportCurve): Result<Corner> {
    const temp1 = maximalEdge(edge1, s1, s2);
    const temp2 = maximalEdge(edge2, s2, s1);
    try {
        const candidates = temp1.intersect(temp2).flatMap((x): IntersectionCandidate[] => {
            const p2 = temp2.curve.parameter(x.point, Precision.Distance);
            return p2 === undefined
                ? []
                : [{ point: x.point, p1: normalizeToRange(x.parameter, s1), p2: normalizeToRange(p2, s2) }];
        });
        if (candidates.length === 0) {
            return Result.err("Edges do not intersect when extended");
        }

        const cost = (c: IntersectionCandidate) =>
            endpointDistance(c.p1, c.point, s1) + endpointDistance(c.p2, c.point, s2);
        candidates.sort((a, b) => cost(a) - cost(b));
        return Result.ok(candidates[0]);
    } finally {
        temp1.dispose();
        temp2.dispose();
    }
}

/**
 * Rebuild the edge so its range reaches p. When p cuts the edge in two only
 * the longer side is kept; when p lies outside the edge is extended up to p.
 * An arc may never grow to a full circle.
 */
function edgeThroughParameter(edge: IEdge, support: SupportCurve, p: number): Result<IEdge> {
    let [first, last] = [support.first, support.last];
    if (p > first && p < last) {
        if (p - first >= last - p) {
            last = p;
        } else {
            first = p;
        }
    } else {
        first = Math.min(first, p);
        last = Math.max(last, p);
    }

    if (support.period > 0 && last - first >= support.period - Precision.Angle) {
        return Result.err("Arc would become a full circle");
    }
    return Result.ok(edge.trim(first, last));
}

/** Extend (or trim) two straight edges or arcs until they meet. */
function extendEdgesToCorner(edge1: IEdge, edge2: IEdge): Result<[IEdge, IEdge]> {
    const s1 = supportCurve(edge1);
    const s2 = supportCurve(edge2);
    if (s1 === undefined || s2 === undefined) {
        return Result.err("Edges must be straight lines or arcs");
    }

    const corner =
        s1.period === 0 && s2.period === 0
            ? lineIntersection(s1, s2)
            : curveIntersection(edge1, s1, edge2, s2);
    if (!corner.isOk) return corner.parse();

    const ext1 = edgeThroughParameter(edge1, s1, corner.value.p1);
    if (!ext1.isOk) return ext1.parse();

    const ext2 = edgeThroughParameter(edge2, s2, corner.value.p2);
    if (!ext2.isOk) {
        ext1.value.dispose();
        return ext2.parse();
    }
    return Result.ok([ext1.value, ext2.value]);
}

/** Splice the extended pair into the wire edges in place of the two old edges. */
function spliceExtendedEdges(allEdges: IEdge[], corner: OrderedCorner, extended: [IEdge, IEdge]): IEdge[] {
    const [ext1, ext2] = extended;
    const { index1, index2 } = corner;
    if (index1 === allEdges.length - 1) {
        // wrap: the corner spans the last and the first edge
        return [ext2, ...allEdges.slice(1, -1), ext1];
    }
    return [...allEdges.slice(0, index1), ext1, ext2, ...allEdges.slice(index2 + 1)];
}

/**
 * Extend two straight edges or arcs until they meet. The edges can be two
 * standalone edge bodies or two adjacent edges of a wire; each edge is
 * prolonged (or cut back) along its support curve up to the intersection of
 * the two curves.
 */
@command({
    key: "modify.extend",
    icon: "icon-extend",
})
export class ExtendCommand extends MultistepCommand {
    protected override executeMainTask() {
        Transaction.execute(this.document, `excute ${Object.getPrototypeOf(this).data.name}`, () => {
            const shapes = this.stepDatas[0].shapes;
            const parent = (shapes[0].shape as ISubEdgeShape).parent;

            if (parent.shapeType === ShapeTypes.edge) {
                this.extendStandaloneEdges(shapes);
                return;
            }

            this.extendWireEdges(shapes, parent);
        });
    }

    /** Extend two adjacent edges of a wire until they meet and rebuild the wire. */
    private extendWireEdges(shapes: VisualShapeData[], wire: IShape) {
        const node = shapes[0].owner.node as ShapeNode;
        const newWire = this.computeExtendedWire(shapes, wire);
        if (!newWire.isOk) {
            PubSub.default.pub("displayError", newWire.error);
            return;
        }
        replaceShapeNode(node, newWire.value);
    }

    private computeExtendedWire(shapes: VisualShapeData[], wire: IShape): Result<IShape> {
        const allEdges = wire.findSubShapes(ShapeTypes.edge) as IEdge[];
        const corner = orderCornerEdges(
            allEdges,
            shapes[0].shape as ISubEdgeShape,
            shapes[1].shape as ISubEdgeShape,
        );
        if (corner === undefined || (corner.index1 + 1) % allEdges.length !== corner.index2) {
            return Result.err("Edges must be adjacent edges of the wire.");
        }

        const extended = extendEdgesToCorner(corner.edge1, corner.edge2);
        if (!extended.isOk) return extended.parse();

        return shapeFactory.wire(spliceExtendedEdges(allEdges, corner, extended.value));
    }

    /** Extend two standalone edge bodies until they meet, keeping them as separate edges. */
    private extendStandaloneEdges(shapes: VisualShapeData[]) {
        if (shapes.length !== 2) {
            PubSub.default.pub("displayError", I18n.translate("error.select.twoEdges"));
            return;
        }

        const [edge1, edge2] = shapes.map((x) => {
            const edge = x.shape.transformedMul(x.transform) as IEdge;
            this.disposeStack.add(edge);
            return edge;
        });

        const extended = extendEdgesToCorner(edge1, edge2);
        if (!extended.isOk) {
            PubSub.default.pub("displayError", extended.error);
            return;
        }

        this.replaceStandaloneNodes(shapes, extended.value);
    }

    /**
     * Replace the two standalone edge nodes by their extended versions. The
     * extended geometry is in world space (the transforms were baked in), so
     * no transform is copied.
     */
    private replaceStandaloneNodes(shapes: VisualShapeData[], extended: [IEdge, IEdge]) {
        const [ext1, ext2] = extended;
        const node1 = shapes[0].owner.node as ShapeNode;
        const node2 = shapes[1].owner.node as ShapeNode;
        const container1 = node1.parent ?? this.document.modelManager.rootNode;
        const container2 = node2.parent ?? this.document.modelManager.rootNode;

        container1.add(this.standaloneEdgeNode(node1, ext1));
        container2.add(this.standaloneEdgeNode(node2, ext2));
        node1.parent?.remove(node1);
        node2.parent?.remove(node2);
        this.document.visual.update();
    }

    private standaloneEdgeNode(source: ShapeNode, shape: IEdge) {
        return new EditableShapeNode({
            document: this.document,
            name: source.name,
            shape,
            materialId: source.materialId,
        });
    }

    /**
     * Only standalone edge bodies and wire edges can be extended. The second
     * edge can only be picked on the same shape as the first one: a wire edge
     * must share the first edge's wire, and a standalone edge can only be
     * paired with another standalone edge.
     */
    private readonly _edgeFilter: IShapeFilter = {
        allow: (shape) => this.canPickEdge(shape as ISubEdgeShape),
    };

    private canPickEdge(shape: ISubEdgeShape): boolean {
        const parent = shape.parent;
        if (parent === undefined) return false;
        if (parent.shapeType !== ShapeTypes.edge && parent.shapeType !== ShapeTypes.wire) return false;

        const selected = this.document.selection.getSelectedShapes();
        if (selected.length >= 2) {
            // allow re-picking an already selected edge so it can be toggled off
            return selected.some((x) => x.shape.isEqual(shape));
        }

        const firstParent = (selected.at(0)?.shape as ISubEdgeShape | undefined)?.parent;
        if (firstParent === undefined) return true;
        if (firstParent.shapeType === ShapeTypes.edge) {
            return parent.shapeType === ShapeTypes.edge;
        }
        return parent.shapeType === ShapeTypes.wire && parent.isPartner(firstParent);
    }

    protected override getSteps() {
        return [
            new SelectShapeStep(ShapeTypes.edge, "prompt.select.edges", {
                multiple: true,
                shapeFilter: this._edgeFilter,
                canFinish: this._canFinish,
            }),
        ];
    }

    /** Extending needs exactly two edges - finish the pick once both are selected. */
    private readonly _canFinish = (selected: VisualShapeData[]) => selected.length === 2;
}
