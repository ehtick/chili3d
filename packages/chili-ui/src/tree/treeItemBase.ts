// Copyright 2022-2023 the Chili authors. All rights reserved. MPL-2.0 license.

import { IDocument, IModel, INode, Transaction } from "chili-core";
import { SVGBuilder } from "../builder";
import { HTMLElementBase, UIText } from "../components";
import style from "./treeItemBase.module.css";

export abstract class TreeItem extends HTMLElementBase {
    readonly name: UIText;
    readonly visibleIcon: SVGSVGElement;

    constructor(readonly document: IDocument, readonly node: INode) {
        super();
        this.draggable = true;
        this.name = new UIText().textBinding(node, "name").addClass(style.name);
        this.visibleIcon = new SVGBuilder()
            .setIcon(this.getVisibleIcon())
            .onClick(this.onVisibleIconClick)
            .addClass(style.icon)
            .build();

        node.onPropertyChanged(this.onPropertyChanged);
    }

    private onPropertyChanged = (model: INode, property: keyof INode, old: any, newValue: any) => {
        if (property === "visible") {
            SVGBuilder.setIcon(this.visibleIcon, this.getVisibleIcon());
        } else if (property === "parentVisible") {
            if (newValue) {
                this.visibleIcon.classList.remove(style["parent-visible"]);
            } else {
                this.visibleIcon.classList.add(style["parent-visible"]);
            }
        }
    };

    addSelectedStyle(style: string) {
        this.getSelectedHandler().classList.add(style);
    }

    removeSelectedStyle(style: string) {
        this.getSelectedHandler().classList.remove(style);
    }

    abstract getSelectedHandler(): HTMLElement;

    override dispose(): void | Promise<void> {
        super.dispose();
        this.visibleIcon.removeEventListener("click", this.onVisibleIconClick);
    }

    private getVisibleIcon() {
        return this.node.visible === true ? "icon-eye" : "icon-eye-slash";
    }

    private onVisibleIconClick = (e: MouseEvent) => {
        e.stopPropagation();
        Transaction.excute(this.document, "change visible", () => {
            this.node.visible = !this.node.visible;
        });
        this.document.viewer.redraw();
    };
}
