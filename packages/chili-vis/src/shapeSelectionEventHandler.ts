// Copyright 2022-2023 the Chili authors. All rights reserved. AGPL-3.0 license.

import { IDocument, IView, VisualShapeData, VisualState } from "chili-core";
import { ShapeSelectionHandler } from "./selectionEventHandler";

export class SubshapeSelectionHandler extends ShapeSelectionHandler {
    private readonly _shapes: Set<VisualShapeData> = new Set();

    shapes(): VisualShapeData[] {
        return [...this._shapes];
    }

    override clearSelected(document: IDocument): void {
        let highlighter = document.visual.highlighter;
        for (const shape of this._shapes.values()) {
            highlighter.removeState(
                shape.owner,
                VisualState.selected,
                shape.shape.shapeType,
                ...shape.indexes,
            );
        }
        this._shapes.clear();
    }

    protected override select(view: IView, event: PointerEvent): number {
        const document = view.document.visual.document;
        if (event.shiftKey) {
            this._highlights?.forEach((x) =>
                this._shapes.has(x) ? this.removeSelected(x) : this.addSelected(x),
            );
        } else {
            this.clearSelected(document);
            this._highlights?.forEach(this.addSelected.bind(this));
        }
        return this._shapes.size;
    }

    private removeSelected(shape: VisualShapeData) {
        this._shapes.delete(shape);
        shape.owner.geometryNode.document.visual.highlighter.removeState(
            shape.owner,
            VisualState.selected,
            shape.shape.shapeType,
            ...shape.indexes,
        );
    }

    private addSelected(shape: VisualShapeData) {
        shape.owner.geometryNode.document.visual.highlighter.addState(
            shape.owner,
            VisualState.selected,
            this.shapeType,
            ...shape.indexes,
        );
        this._shapes.add(shape);
    }
}
