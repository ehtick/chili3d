// Copyright 2022-2023 the Chili authors. All rights reserved. MPL-2.0 license.

import { Application } from "chili";
import { IDocument, IPropertyChanged, PubSub } from "chili-core";
import { UIText } from "../../components";
import { Control } from "../../control";
import style from "./title.module.css";

const AppName = "Chili 2023";

export class Title {
    private readonly _documentName: UIText;
    private readonly _appName: HTMLSpanElement;
    private readonly _saveState: HTMLSpanElement;

    private currentDocument: IDocument | undefined;

    constructor(readonly container: HTMLDivElement) {
        this._documentName = new UIText().addClass(style.documentName);
        this._appName = Control.textSpan(AppName, style.appName);
        this._saveState = Control.textSpan("*", style.savedStatus);
        Control.append(container, this._documentName, this._saveState, this._appName);
        this.setSaveStatus(true);

        PubSub.default.sub("activeDocumentChanged", this.handleActiveDocumentChanged);
    }

    private handleActiveDocumentChanged = (d: IDocument | undefined) => {
        if (this.currentDocument !== undefined) {
            this.currentDocument.removePropertyChanged(this.handleNameChanged);
        }
        this._documentName.text(d?.name ?? "");
        this.currentDocument = d;
        this.currentDocument?.onPropertyChanged(this.handleNameChanged);
    };

    private handleNameChanged = (d: IDocument, property: keyof IDocument, oldValue: any, newValue: any) => {
        if (property === "name") {
            this._documentName.text(newValue);
        }
    };

    setSaveStatus(saved: boolean) {
        if (saved) this._saveState.style.visibility = "hidden";
        else this._saveState.style.visibility = "visible";
    }
}
