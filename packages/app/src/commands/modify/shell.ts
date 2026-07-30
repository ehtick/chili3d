// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    Combobox,
    command,
    EditableShapeNode,
    type I18nKeys,
    type IFace,
    type JoinType,
    MultistepCommand,
    property,
    SelectShapeStep,
    type ShapeNode,
    ShapeTypes,
    Transaction,
    VisualStates,
} from "@chili3d/core";

@command({
    key: "modify.shell",
    icon: "icon-shell",
})
export class ShellCommand extends MultistepCommand {
    @property("option.command.joinType", {
        combobox: Combobox.from(["option.command.joinType.arc", "option.command.joinType.intersection"]),
    })
    get joinType(): I18nKeys {
        return this.getPrivateValue("joinType", "option.command.joinType.arc");
    }
    set joinType(value: I18nKeys) {
        this.setProperty("joinType", value);
    }

    @property("option.command.thickness")
    get thickness() {
        return this.getPrivateValue("thickness", 1);
    }

    set thickness(value: number) {
        this.setProperty("thickness", value);
    }

    protected override executeMainTask() {
        Transaction.execute(this.document, `excute ${Object.getPrototypeOf(this).data.name}`, () => {
            const node = this.stepDatas[0].shapes[0].owner.node as ShapeNode;
            const faces = this.stepDatas.at(-1)!.shapes.map((x) => x.shape as IFace);
            const shellShape = shapeFactory.makeThickSolidByJoin(
                node.shape.value,
                faces,
                this.thickness,
                this.mapJoinType(),
            );

            if (!shellShape.isOk) {
                return;
            }

            const model = new EditableShapeNode({
                document: this.document,
                name: node.name,
                shape: shellShape,
                materialId: node.materialId,
            });
            model.transform = node.transform;

            (node.parent ?? this.document.modelManager.rootNode).add(model);
            node.parent?.remove(node);
            this.document.visual.update();
        });
    }

    protected override getSteps() {
        return [
            new SelectShapeStep(ShapeTypes.shape, "prompt.select.shape", {
                shapeFilter: {
                    allow: (shape) => {
                        return (
                            shape.shapeType === ShapeTypes.solid ||
                            shape.shapeType === ShapeTypes.compound ||
                            shape.shapeType === ShapeTypes.compoundSolid
                        );
                    },
                },
                selectedState: VisualStates.faceTransparent,
            }),
            new SelectShapeStep(ShapeTypes.face, "prompt.select.openFaces", {
                multiple: true,
                beforeSelection: () => this.addFirstSelectedState(VisualStates.faceTransparent),
                afterSelection: () => this.removeFirstSelectedState(VisualStates.faceTransparent),
            }),
        ];
    }

    readonly mapJoinType = (): JoinType => {
        switch (this.joinType) {
            case "option.command.joinType.arc":
                return "arc";
            case "option.command.joinType.intersection":
                return "intersection";
            case "option.command.joinType.tangent":
                return "tangent";
            default:
                throw new Error("Unknow joinType");
        }
    };
}
