// Copyright 2022-2023 the Chili authors. All rights reserved. MPL-2.0 license.

import { ICollectionNode, IDocument, INode } from "chili-core";
import { SVGBuilder } from "../builder";
import { UIColumn, UIRow } from "../components";
import { customElement } from "../components/base";
import { TreeItem } from "./treeItemBase";
import style from "./treeItemGroup.module.css";

@customElement("tree-group")
export class TreeGroup extends TreeItem {
    private _isExpanded: boolean = true;
    readonly header: UIRow;
    readonly items: UIColumn = new UIColumn().addClass(style.container);
    readonly expanderIcon: SVGSVGElement;

    constructor(document: IDocument, node: ICollectionNode) {
        super(document, node);
        this.expanderIcon = new SVGBuilder()
            .setIcon(this.getExpanderIcon())
            .addClass(style["expander-icon"])
            .onClick(this.handleExpanderClick)
            .build();
        this.header = new UIRow(this.expanderIcon, this.name, this.visibleIcon).addClass(style.header);
        super.appendChild(new UIColumn(this.header, this.items));
    }

    getSelectedHandler(): HTMLElement {
        return this.header;
    }

    override dispose(): void | Promise<void> {
        super.dispose();
        this.expanderIcon.removeEventListener("click", this.handleExpanderClick);
    }

    private handleExpanderClick = (e: MouseEvent) => {
        e.stopPropagation();
        this._isExpanded = !this._isExpanded;
        SVGBuilder.setIcon(this.expanderIcon, this.getExpanderIcon());
        if (this._isExpanded) {
            this.items.classList.remove(style.hide);
        } else {
            this.items.classList.add(style.hide);
        }
    };

    private getExpanderIcon() {
        return this._isExpanded === true ? "icon-angle-down" : "icon-angle-right";
    }

    override appendChild<T extends Node>(node: T): T {
        this.items.appendChild(node);
        return node;
    }

    override removeChild<T extends Node>(child: T): T {
        this.items.removeChild(child);
        return child;
    }

    insertAfter(item: TreeItem, child: TreeItem | null): void {
        this.items.insertBefore(item, child?.nextSibling ?? null);
    }
}
