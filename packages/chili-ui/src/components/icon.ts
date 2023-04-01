// Copyright 2022-2023 the Chili authors. All rights reserved. MPL-2.0 license.

import { HTMLElementBase } from "./base";

// export class UIIcon extends HTMLElementBase {
//     private svg: SVGSVGElement;

//     constructor(icon: string) {
//         super();
//         const ns = "http://www.w3.org/2000/svg";
//         const childNS = "http://www.w3.org/1999/xlink";
//         const child = document.createElementNS(ns, "use");
//         child.setAttributeNS(childNS, "xlink:href", `#${icon}`);
//         this.svg = document.createElementNS(ns, "svg");
//         this.svg.appendChild(child);
//         this.appendChild(this.svg);
//         this.style.display = "flex";
//         this.style.flexDirection = "row";
//         this.style.alignItems = "center";
//     }

//      setIcon(icon: string) {
//         const childNS = "http://www.w3.org/1999/xlink";
//         let child = this.svg.firstChild as SVGUseElement;
//         child?.setAttributeNS(childNS, "xlink:href", `#${icon}`);
//     }

// }

// customElements.define("ui-svg", UIIcon);
