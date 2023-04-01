// Copyright 2022-2023 the Chili authors. All rights reserved. MPL-2.0 license.

export abstract class Builder<T extends Element & ElementCSSInlineStyle> {
    constructor(protected element: T) {}

    setId(id: string) {
        this.element.id = id;
        return this;
    }

    addStyle(key: keyof CSSStyleDeclaration, value: string) {
        this.element.style[key as any] = value;
        return this;
    }

    addClass(...classes: string[]) {
        this.element.classList.add(...classes);
        return this;
    }

    build() {
        return this.element;
    }
}

export class HTMLBuilder extends Builder<HTMLElement> {
    constructor(tagName: keyof HTMLElementTagNameMap) {
        super(document.createElement(tagName));
    }
}

export class SVGBuilder extends Builder<SVGSVGElement> {
    constructor() {
        super(SVGBuilder.createSVG());
    }

    static createSVG() {
        const ns = "http://www.w3.org/2000/svg";
        const child = document.createElementNS(ns, "use");
        let svg = document.createElementNS(ns, "svg");
        svg.appendChild(child);
        return svg;
    }

    static setIcon(svg: SVGSVGElement, newIcon: string) {
        const childNS = "http://www.w3.org/1999/xlink";
        let child = svg.firstChild as SVGUseElement;
        child?.setAttributeNS(childNS, "xlink:href", `#${newIcon}`);
    }

    setIcon(icon: string) {
        SVGBuilder.setIcon(this.element, icon);
        return this;
    }

    onClick(listener: (this: SVGSVGElement, e: MouseEvent) => void) {
        this.element.addEventListener("click", listener);
        return this;
    }
}
