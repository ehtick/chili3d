// Copyright 2022-2023 the Chili authors. All rights reserved. AGPL-3.0 license.

import {
    Continuity,
    CurveType,
    IBSplineCurve,
    IBezierCurve,
    IBoundedCurve,
    ICircle,
    IConic,
    ICurve,
    IDisposable,
    IEllipse,
    IHyperbola,
    ILine,
    IOffsetCurve,
    IParabola,
    ITrimmedCurve,
    XYZ,
} from "chili-core";
import {
    Geom_BSplineCurve,
    Geom_BezierCurve,
    Geom_BoundedCurve,
    Geom_Circle,
    Geom_Conic,
    Geom_Curve,
    Geom_Hyperbola,
    Geom_Line,
    Geom_OffsetCurve,
    Geom_Parabola,
    Geom_TrimmedCurve,
} from "../occ-wasm/chili_occ";

import { OccHelps } from "./occHelps";
import { Geom_Ellipse } from "opencascade.js/dist/opencascade.full";

export class OccCurve implements ICurve, IDisposable {
    readonly curveType: CurveType;

    constructor(readonly curve: Geom_Curve) {
        this.curveType = OccHelps.getCurveType(curve);
    }

    reversed(): ICurve {
        return OccHelps.wrapCurve(this.curve.Reversed().get());
    }

    isClosed(): boolean {
        return this.curve.IsClosed();
    }

    period(): number {
        return this.curve.Period();
    }

    isPeriodic(): boolean {
        return this.curve.IsPeriodic();
    }

    continutity(): Continuity {
        let cni = this.curve.Continuity();
        switch (cni) {
            case occ.GeomAbs_Shape.GeomAbs_C0:
                return Continuity.C0;
            case occ.GeomAbs_Shape.GeomAbs_G1:
                return Continuity.G1;
            case occ.GeomAbs_Shape.GeomAbs_C1:
                return Continuity.C1;
            case occ.GeomAbs_Shape.GeomAbs_G2:
                return Continuity.G2;
            case occ.GeomAbs_Shape.GeomAbs_C2:
                return Continuity.C2;
            case occ.GeomAbs_Shape.GeomAbs_C3:
                return Continuity.C3;
            case occ.GeomAbs_Shape.GeomAbs_CN:
                return Continuity.CN;
            default:
                throw new Error("unknown continuity");
        }
    }

    nearestPoint(point: XYZ): XYZ {
        let api = new occ.GeomAPI_ProjectPointOnCurve_2(
            OccHelps.toPnt(point),
            new occ.Handle_Geom_Curve_2(this.curve),
        );
        if (api.NbPoints() == 0) {
            let start = this.value(this.curve.FirstParameter());
            let end = this.value(this.curve.LastParameter());
            let distStart = point.distanceTo(start);
            let distEnd = point.distanceTo(end);
            return distStart < distEnd ? start : end;
        }

        let pnt = api.NearestPoint();
        return OccHelps.toXYZ(pnt);
    }

    value(parameter: number): XYZ {
        let p = this.curve.Value(parameter);
        return OccHelps.toXYZ(p);
    }

    firstParameter() {
        return this.curve.FirstParameter();
    }

    lastParameter() {
        return this.curve.LastParameter();
    }

    parameter(point: XYZ): number {
        let api = new occ.GeomAPI_ProjectPointOnCurve_2(
            OccHelps.toPnt(point),
            new occ.Handle_Geom_Curve_2(this.curve),
        );
        return api.LowerDistanceParameter();
    }

    project(point: XYZ): XYZ[] {
        let result = new Array<XYZ>();
        let api = new occ.GeomAPI_ProjectPointOnCurve_2(
            OccHelps.toPnt(point),
            new occ.Handle_Geom_Curve_2(this.curve),
        );
        for (let i = 1; i <= api.NbPoints(); i++) {
            let point = api.Point(i);
            result.push(OccHelps.toXYZ(point));
        }

        result.sort((a, b) => a.distanceTo(point) - b.distanceTo(point));
        return result;
    }

    isCN(n: number): boolean {
        return this.curve.IsCN(n);
    }

    d0(u: number) {
        let pnt = new occ.gp_Pnt_1();
        this.curve.D0(u, pnt);
        return OccHelps.toXYZ(pnt);
    }

    d1(u: number) {
        let pnt = new occ.gp_Pnt_1();
        let vec = new occ.gp_Vec_1();
        this.curve.D1(u, pnt, vec);
        return {
            point: OccHelps.toXYZ(pnt),
            vec: OccHelps.toXYZ(vec),
        };
    }

    d2(u: number) {
        let pnt = new occ.gp_Pnt_1();
        let vec1 = new occ.gp_Vec_1();
        let vec2 = new occ.gp_Vec_1();
        this.curve.D2(u, pnt, vec1, vec2);
        return {
            point: OccHelps.toXYZ(pnt),
            vec1: OccHelps.toXYZ(vec1),
            vec2: OccHelps.toXYZ(vec2),
        };
    }

    d3(u: number) {
        let pnt = new occ.gp_Pnt_1();
        let vec1 = new occ.gp_Vec_1();
        let vec2 = new occ.gp_Vec_1();
        let vec3 = new occ.gp_Vec_1();
        this.curve.D3(u, pnt, vec1, vec2, vec3);
        return {
            point: OccHelps.toXYZ(pnt),
            vec1: OccHelps.toXYZ(vec1),
            vec2: OccHelps.toXYZ(vec2),
            vec3: OccHelps.toXYZ(vec3),
        };
    }

    dn(u: number, n: number) {
        return OccHelps.toXYZ(this.curve.DN(u, n));
    }

    dispose() {
        this.curve.delete();
    }
}

export class OccLine extends OccCurve implements ILine {
    constructor(private line: Geom_Line) {
        super(line);
    }

    get direction(): XYZ {
        return OccHelps.toXYZ(this.lin().Direction());
    }

    set direction(value: XYZ) {
        this.line.SetDirection(OccHelps.toDir(value));
    }

    get location(): XYZ {
        return OccHelps.toXYZ(this.lin().Location());
    }

    set location(value: XYZ) {
        this.line.SetLocation(OccHelps.toPnt(value));
    }

    private lin() {
        return this.line.Lin();
    }
}

export class OccConic extends OccCurve implements IConic {
    constructor(private conion: Geom_Conic) {
        super(conion);
    }
    get axis(): XYZ {
        return OccHelps.toXYZ(this.conion.Axis().Direction());
    }
    get xAxis(): XYZ {
        return OccHelps.toXYZ(this.conion.XAxis().Direction());
    }
    get yAxis(): XYZ {
        return OccHelps.toXYZ(this.conion.YAxis().Direction());
    }
    eccentricity(): number {
        return this.conion.Eccentricity();
    }
}

export class OccCircle extends OccConic implements ICircle {
    constructor(private circle: Geom_Circle) {
        super(circle);
    }

    get center(): XYZ {
        return OccHelps.toXYZ(this.circle.Location());
    }

    set center(value: XYZ) {
        this.circle.SetLocation(OccHelps.toPnt(value));
    }

    get radius(): number {
        return this.circle.Radius();
    }

    set radius(value: number) {
        this.circle.SetRadius(value);
    }
}

export class OccEllipse extends OccConic implements IEllipse {
    constructor(private ellipse: Geom_Ellipse) {
        super(ellipse);
    }

    get center(): XYZ {
        return OccHelps.toXYZ(this.ellipse.Location());
    }
    set center(value: XYZ) {
        this.ellipse.SetLocation(OccHelps.toPnt(value));
    }

    get focus1(): XYZ {
        return OccHelps.toXYZ(this.ellipse.Focus1());
    }
    get focus2(): XYZ {
        return OccHelps.toXYZ(this.ellipse.Focus2());
    }

    get majorRadius(): number {
        return this.ellipse.MajorRadius();
    }
    set majorRadius(value: number) {
        this.ellipse.SetMajorRadius(value);
    }

    get minorRadius(): number {
        return this.ellipse.MinorRadius();
    }
    set minorRadius(value: number) {
        this.ellipse.SetMinorRadius(value);
    }

    area(): number {
        return this.ellipse.Elips().Area();
    }
}

export class OccHyperbola extends OccConic implements IHyperbola {
    constructor(private hyperbola: Geom_Hyperbola) {
        super(hyperbola);
    }
    focal(): number {
        return this.hyperbola.Focal();
    }
    get location(): XYZ {
        return OccHelps.toXYZ(this.hyperbola.Location());
    }
    set location(value: XYZ) {
        this.hyperbola.SetLocation(OccHelps.toPnt(value));
    }

    get focus1(): XYZ {
        return OccHelps.toXYZ(this.hyperbola.Focus1());
    }
    get focus2(): XYZ {
        return OccHelps.toXYZ(this.hyperbola.Focus2());
    }
    get majorRadius(): number {
        return this.hyperbola.MajorRadius();
    }
    set majorRadius(value: number) {
        this.hyperbola.SetMajorRadius(value);
    }

    get minorRadius(): number {
        return this.hyperbola.MinorRadius();
    }
    set minorRadius(value: number) {
        this.hyperbola.SetMinorRadius(value);
    }
}

export class OccParabola extends OccConic implements IParabola {
    constructor(private parabola: Geom_Parabola) {
        super(parabola);
    }
    focal(): number {
        return this.parabola.Focal();
    }

    get focus(): XYZ {
        return OccHelps.toXYZ(this.parabola.Focus());
    }

    get directrix() {
        return OccHelps.toXYZ(this.parabola.Directrix().Direction());
    }
}

export class OccBoundedCurve extends OccCurve implements IBoundedCurve {
    constructor(private boundedCurve: Geom_BoundedCurve) {
        super(boundedCurve);
    }

    startPoint(): XYZ {
        return OccHelps.toXYZ(this.boundedCurve.StartPoint());
    }

    endPoint(): XYZ {
        return OccHelps.toXYZ(this.boundedCurve.EndPoint());
    }
}

export class OccTrimmedCurve extends OccBoundedCurve implements ITrimmedCurve {
    constructor(private trimmedCurve: Geom_TrimmedCurve) {
        super(trimmedCurve);
    }

    basisCurve(): ICurve {
        return OccHelps.wrapCurve(this.trimmedCurve.BasisCurve().get());
    }
}

export class OccOffsetCurve extends OccCurve implements IOffsetCurve {
    constructor(private offsetCurve: Geom_OffsetCurve) {
        super(offsetCurve);
    }

    basisCurve(): ICurve {
        return OccHelps.wrapCurve(this.offsetCurve.BasisCurve().get());
    }

    offset(): number {
        return this.offsetCurve.Offset();
    }

    direction(): XYZ {
        return OccHelps.toXYZ(this.offsetCurve.Direction());
    }
}

export class OccBezierCurve extends OccBoundedCurve implements IBezierCurve {
    constructor(private bezier: Geom_BezierCurve) {
        super(bezier);
    }

    weight(index: number): number {
        return this.bezier.Weight(index);
    }

    insertPoleAfter(index: number, point: XYZ, weight: number | undefined): void {
        if (weight === undefined) {
            this.bezier.InsertPoleAfter_1(index, OccHelps.toPnt(point));
        } else {
            this.bezier.InsertPoleAfter_2(index, OccHelps.toPnt(point), weight);
        }
    }

    insertPoleBefore(index: number, point: XYZ, weight: number | undefined): void {
        if (weight === undefined) {
            this.bezier.InsertPoleBefore_1(index, OccHelps.toPnt(point));
        } else {
            this.bezier.InsertPoleBefore_2(index, OccHelps.toPnt(point), weight);
        }
    }

    removePole(index: number): void {
        this.bezier.RemovePole(index);
    }

    setPole(index: number, point: XYZ, weight: number | undefined): void {
        if (weight === undefined) {
            this.bezier.SetPole_1(index, OccHelps.toPnt(point));
        } else {
            this.bezier.SetPole_2(index, OccHelps.toPnt(point), weight);
        }
    }

    setWeight(index: number, weight: number): void {
        this.setWeight(index, weight);
    }

    nbPoles(): number {
        return this.bezier.NbPoles();
    }

    pole(index: number): XYZ {
        return OccHelps.toXYZ(this.bezier.Pole(index));
    }

    degree(): number {
        return this.bezier.Degree();
    }

    poles(): XYZ[] {
        let result: XYZ[] = [];
        let pls = this.bezier.Poles_2();
        for (let i = 1; i <= pls.Length(); i++) {
            result.push(OccHelps.toXYZ(pls.Value(i)));
        }
        return result;
    }
}

export class OccBSplineCurve extends OccBoundedCurve implements IBSplineCurve {
    constructor(private bspline: Geom_BSplineCurve) {
        super(bspline);
    }
    nbKnots(): number {
        return this.bspline.NbKnots();
    }
    knot(index: number): number {
        return this.bspline.Knot(index);
    }
    setKnot(index: number, value: number): void {
        this.bspline.SetKnot_1(index, value);
    }
    nbPoles(): number {
        return this.bspline.NbPoles();
    }
    pole(index: number): XYZ {
        return OccHelps.toXYZ(this.bspline.Pole(index));
    }
    poles(): XYZ[] {
        let result: XYZ[] = [];
        let pls = this.bspline.Poles_2();
        for (let i = 1; i <= pls.Length(); i++) {
            result.push(OccHelps.toXYZ(pls.Value(i)));
        }
        return result;
    }
    weight(index: number): number {
        return this.bspline.Weight(index);
    }
    setWeight(index: number, value: number): void {
        this.bspline.SetWeight(index, value);
    }

    degree(): number {
        return this.bspline.Degree();
    }
}
