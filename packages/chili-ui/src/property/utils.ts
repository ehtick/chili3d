// Copyright 2022-2023 the Chili authors. All rights reserved. AGPL-3.0 license.

import { IConverter, IDocument, Logger, Property, Texture } from "chili-core";
import { CheckProperty } from "./check";
import { ColorProperty } from "./colorProperty";
import { InputProperty } from "./input";
import { TextureProperty } from "./material/textureEditor";
import { MaterialProperty } from "./materialProperty";

export function findPropertyControl(
    document: IDocument,
    objs: any[],
    prop: Property,
    converter?: IConverter,
) {
    if (prop === undefined || objs.length === 0) return "";

    if (prop.type === "color") {
        return new ColorProperty(document, objs, prop);
    }

    if (prop.type === "materialId" && canShowMaterialProperty(objs, prop)) {
        return new MaterialProperty(document, objs, prop);
    }

    const value = objs[0][prop.name];
    if (value instanceof Texture) {
        return new TextureProperty(document, prop.display, value);
    }

    if (["object", "string", "number"].includes(typeof value)) {
        return new InputProperty(document, objs, prop, converter);
    }

    if (typeof value === "boolean") {
        return new CheckProperty(objs, prop);
    }

    Logger.warn(`Property ${prop.name} not found in ${Object.getPrototypeOf(objs[0]).constructor.name}`);
    return "";
}

function canShowMaterialProperty(objs: any[], prop: Property) {
    if (objs.length === 0) return false;
    if (objs.length === 1) return true;
    return objs.every((obj) => obj[prop.name] === objs[0][prop.name]);
}