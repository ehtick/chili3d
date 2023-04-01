// Copyright 2022-2023 the Chili authors. All rights reserved. MPL-2.0 license.

import { IConverter, IPropertyChanged } from "chili-core";
import { HTMLElementBase } from "./base";
import style from "./text.module.css";

export class UIText extends HTMLElementBase {
    constructor() {
        super();
        this.addClass(style.text);
    }

    text(text: string) {
        this.textContent = text;
        return this;
    }

    textBinding<T extends IPropertyChanged>(source: T, property: keyof T, converter?: IConverter) {
        this.textContent = this.convertToString<T>(source, property, converter);
        this.handles.push([
            source,
            (source, p, oldValue, newValue) => {
                if (property === p) {
                    this.textContent = newValue;
                }
            },
        ]);
        return this;
    }

    private convertToString<T extends IPropertyChanged>(
        source: T,
        property: keyof T,
        converter?: IConverter
    ): string | null {
        return converter?.convert(source[property]) ?? String(source[property]);
    }
}

customElements.define("ui-text", UIText);
