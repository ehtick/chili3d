// Copyright 2022-2023 the Chili authors. All rights reserved. MPL-2.0 license.

import { HistoryObservable, ICollection, IPropertyChanged, PubSub } from "../base";
import { property } from "../decorators";
import { IDocument } from "../document";
import { ICompound, IShape } from "../geometry";
import { Id } from "../id";
import { Quaternion, Matrix4, XYZ } from "../math";
import { Entity } from "./entity";

export interface INode extends IPropertyChanged {
    readonly id: string;
    visible: boolean;
    parentVisible: boolean;
    name: string;
    parent: ICollectionNode | undefined;
    previousSibling: INode | undefined;
    nextSibling: INode | undefined;
}

export interface ICollectionNode extends INode, ICollection<INode> {
    firstChild(): INode | undefined;
    lastChild(): INode | undefined;
    insertBefore(target: INode | undefined, node: INode): void;
    insertAfter(target: INode | undefined, node: INode): void;
    moveToAfter(child: INode, newParent: ICollectionNode, target?: INode): void;
}

export interface IModel<T extends IShape = IShape> extends INode {
    readonly document: IDocument;
    readonly body: Entity;
    transform(): Matrix4;
    translation: XYZ;
    rotation: Quaternion;
    scale: XYZ;
    shape(): T | undefined;
}

export interface IModelGroup extends IModel<ICompound> {
    children: ReadonlyArray<IModel>;
}

export interface INodeCollection extends ICollection<INode> {
    get(id: string): INode | undefined;
}

export namespace INode {
    export function isCollectionNode(node: INode): node is ICollectionNode {
        return (node as ICollectionNode).firstChild !== undefined;
    }

    export function isModelNode(node: INode): node is IModel {
        return (node as IModel).translation !== undefined;
    }

    export function isModelGroup(node: INode): node is IModelGroup {
        let group = node as IModelGroup;
        return group.translation !== undefined && group.children !== undefined;
    }
}

export abstract class Node extends HistoryObservable implements INode {
    private _visible: boolean = true;
    private _parentVisible: boolean = true;

    parent: ICollectionNode | undefined;
    previousSibling: INode | undefined;
    nextSibling: INode | undefined;

    constructor(document: IDocument, private _name: string, readonly id: string = Id.new()) {
        super(document);
    }

    @property("name")
    get name() {
        return this._name;
    }

    set name(value: string) {
        this.setProperty("name", value);
    }

    get visible(): boolean {
        return this._visible;
    }

    set visible(value: boolean) {
        this.setProperty("visible", value, () => this.onVisibleChanged());
    }

    protected abstract onVisibleChanged(): void;

    get parentVisible() {
        return this._parentVisible;
    }

    set parentVisible(value: boolean) {
        this.setProperty("parentVisible", value, () => this.onParentVisibleChanged());
    }

    protected abstract onParentVisibleChanged(): void;
}

export namespace INode {
    export function getNodesBetween(node1: INode, node2: INode): INode[] {
        if (node1 === node2) return [node1];
        let nodes: INode[] = [];
        let prePath = getPathToRoot(node1);
        let curPath = getPathToRoot(node2);
        let index = getCommonParentIndex(prePath, curPath);
        let parent = prePath.at(1 - index) as ICollectionNode;
        if (parent === curPath[0] || parent === prePath[0]) {
            let child = parent === curPath[0] ? prePath[0] : curPath[0];
            getNodesFromParentToChild(nodes, parent, child);
        } else {
            if (currentAtBack(prePath.at(-index)!, curPath.at(-index)!)) {
                getNodesFromPath(nodes, prePath, curPath, index);
            } else {
                getNodesFromPath(nodes, curPath, prePath, index);
            }
        }
        return nodes;
    }

    function getNodesFromPath(nodes: INode[], path1: INode[], path2: INode[], commonIndex: number) {
        getNodesAndChildren(nodes, path1[0]);
        for (let i = 0; i < path1.length - commonIndex; i++) {
            let next = path1[i].nextSibling;
            while (next !== undefined) {
                getNodesAndChildren(nodes, next);
                next = next.nextSibling;
            }
        }

        let nextParent = path1.at(-commonIndex)?.nextSibling;
        while (nextParent !== undefined) {
            if (nextParent === path2[0]) {
                nodes.push(path2[0]);
                return;
            }
            if (INode.isCollectionNode(nextParent)) {
                if (getNodesFromParentToChild(nodes, nextParent, path2[0])) {
                    return;
                }
            } else nodes.push(nextParent);
            nextParent = nextParent.nextSibling;
        }
    }

    function getNodesAndChildren(nodes: INode[], node: INode) {
        if (INode.isCollectionNode(node)) {
            getNodesFromParentToChild(nodes, node);
        } else {
            nodes.push(node);
        }
    }

    function getNodesFromParentToChild(nodes: INode[], parent: ICollectionNode, until?: INode): boolean {
        nodes.push(parent);
        let node = parent.firstChild();
        while (node !== undefined) {
            if (until === node) {
                nodes.push(node);
                return true;
            }
            if (INode.isCollectionNode(node)) {
                if (getNodesFromParentToChild(nodes, node, until)) return true;
            } else {
                nodes.push(node);
            }
            node = node.nextSibling;
        }
        return false;
    }

    function currentAtBack(preNode: INode, curNode: INode) {
        while (preNode.nextSibling !== undefined) {
            if (preNode.nextSibling === curNode) return true;
            preNode = preNode.nextSibling;
        }
        return false;
    }

    function getCommonParentIndex(prePath: INode[], curPath: INode[]) {
        let index = 1;
        for (index; index <= Math.min(prePath.length, curPath.length); index++) {
            if (prePath.at(-index) !== curPath.at(-index)) break;
        }
        if (prePath.at(1 - index) !== curPath.at(1 - index)) throw "can not find a common parent";
        return index;
    }

    function getPathToRoot(node: INode): INode[] {
        let path: INode[] = [];
        let parent: INode | undefined = node;
        while (parent !== undefined) {
            path.push(parent);
            parent = parent.parent;
        }
        return path;
    }
}