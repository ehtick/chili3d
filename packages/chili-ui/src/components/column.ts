// Copyright 2022-2023 the Chili authors. All rights reserved. MPL-2.0 license.

import { HTMLElementBase } from "./base";
import style from "./column.module.css";

export class UIColumn extends HTMLElementBase {
    constructor(...children: Node[]) {
        super();
        this.add(...children);
        this.addClass(style.column);
    }

    add(...children: Node[]) {
        children.forEach((x) => this.appendChild(x));
    }

    override remove(...children: Node[]) {
        children.forEach((x) => this.removeChild(x));
    }
}

customElements.define("ui-column", UIColumn);
