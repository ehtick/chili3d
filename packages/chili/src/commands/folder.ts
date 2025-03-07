// Copyright 2022-2023 the Chili authors. All rights reserved. AGPL-3.0 license.

import { command, FolderNode, IApplication, ICommand } from "chili-core";

let index = 1;

@command({
    name: "create.folder",
    display: "command.newFolder",
    icon: "icon-folder-plus",
})
export class NewFolder implements ICommand {
    async execute(app: IApplication): Promise<void> {
        const document = app.activeView?.document!;
        const folder = new FolderNode(document, `Folder${index++}`);
        document.addNode(folder);
    }
}
