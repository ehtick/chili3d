// Copyright 2022-2023 the Chili authors. All rights reserved. MPL-2.0 license.

import { IDisposable, IPropertyChanged, PropertyChangedHandler } from "chili-core";

export function customElement(tagName: string) {
    return function (ctor: CustomElementConstructor) {
        customElements.define(tagName, ctor);
    };
}

export abstract class HTMLElementBase extends HTMLElement implements IDisposable {
    private onConnectedCallbacks: (() => void)[] = [];
    private onDisconnectedCallbacks: (() => void)[] = [];

    protected readonly handles: [IPropertyChanged, PropertyChangedHandler<any, any>][] = [];

    setId(id: string) {
        this.id = id;
        return this;
    }

    addStyle(key: keyof CSSStyleDeclaration, value: string) {
        this.style[key as any] = value;
        return this;
    }

    addClass(...classes: string[]) {
        this.classList.add(...classes);
        return this;
    }

    removeClass(...classes: string[]) {
        this.classList.remove(...classes);
        return this;
    }

    connectedCallback() {
        this.handles.forEach((x) => x[0].onPropertyChanged(x[1]));
        this.onConnectedCallbacks.forEach((x) => x());
    }

    addConnectedCallback(callback: () => void): this {
        this.onConnectedCallbacks.push(callback);
        return this;
    }

    disconnectedCallback() {
        this.handles.forEach((x) => x[0].removePropertyChanged(x[1]));
        this.onDisconnectedCallbacks.forEach((x) => x());
    }

    addDisconnectedCallback(callback: () => void): this {
        this.onDisconnectedCallbacks.push(callback);
        return this;
    }

    dispose(): void | Promise<void> {
        this.handles.length = 0;
        this.onConnectedCallbacks.length = 0;
        this.onDisconnectedCallbacks.length = 0;
    }
}
