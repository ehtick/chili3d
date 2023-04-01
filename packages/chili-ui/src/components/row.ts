// Copyright 2022-2023 the Chili authors. All rights reserved. MPL-2.0 license.

import { HTMLElementBase } from "./base";
import style from "./row.module.css";

export class UIRow extends HTMLElementBase {
    constructor(...children: Node[]) {
        super();
        this.add(...children);
        this.addClass(style.row);
    }

    add(...children: Node[]) {
        children.forEach((x) => this.appendChild(x));
    }

    override remove(...children: Node[]) {
        children.forEach((x) => this.removeChild(x));
    }
}

customElements.define("ui-row", UIRow);
