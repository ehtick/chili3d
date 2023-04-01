// Copyright 2022-2023 the Chili authors. All rights reserved. MPL-2.0 license.

import { Constants, IDocument, PubSub } from "chili-core";

import { Control } from "../control";
import { PropertyView } from "../property";
import { CheckProperty } from "../property/check";
import { Tab } from "../tab";
import { TreeToolBar } from "../tree/treeToolBar";
import style from "./sidebar.module.css";

export class Sidebar {
    readonly dom: HTMLDivElement;
    readonly modelTreePanel: HTMLDivElement;
    readonly propertyViewPanel: HTMLDivElement;

    constructor() {
        this.dom = Control.div(style.sidebar);
        this.modelTreePanel = Control.div(style.top);
        this.propertyViewPanel = Control.div(style.bottom);
        Control.append(this.dom, this.modelTreePanel, this.propertyViewPanel);
        this.propertyViewPanel.appendChild(new PropertyView().dom);

        let tab = new Tab("items.header");
        tab.addTools(...new TreeToolBar().tools);
        tab.panel.id = Constants.TreeContainerId;
        this.modelTreePanel.appendChild(tab.dom);
    }
}
