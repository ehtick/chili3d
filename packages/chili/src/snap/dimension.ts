// Copyright 2022-2023 the Chili authors. All rights reserved. AGPL-3.0 license.

export enum Dimension {
    None = 0,
    D1 = 1,
    D2 = 2,
    D3 = 4,

    D1D2 = 1 | 2,
    D1D2D3 = 1 | 2 | 4,
}

export namespace Dimension {
    export function contains(d1: Dimension, d2: Dimension): boolean {
        if (d2 === Dimension.None) return false;
        return (d1 & d2) === d2;
    }

    /**
     *
     * @param value 1: D1, 2: D2, 3: D3, other: None
     * @returns
     */
    export function from(value: number): Dimension {
        const mapping: { [key: number]: Dimension } = {
            1: Dimension.D1,
            2: Dimension.D2,
            3: Dimension.D3,
        };
        return mapping[value] || Dimension.None;
    }
}
