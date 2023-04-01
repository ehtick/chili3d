// Copyright 2022-2023 the Chili authors. All rights reserved. MPL-2.0 license.

import { IModel } from "chili-core";
import { UIRow } from "../components";
import { TreeItem } from "./treeItemBase";
import style from "./treeModel.module.css";

export class TreeModel extends TreeItem {
    constructor(node: IModel) {
        super(node.document, node);
        this.append(this.name, this.visibleIcon);
        this.classList.add(style.panel);
    }

    getSelectedHandler(): HTMLElement {
        return this;
    }
}

customElements.define("tree-model", TreeModel);
