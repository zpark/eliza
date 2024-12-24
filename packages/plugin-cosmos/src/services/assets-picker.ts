import { Asset } from "../types";

export class AssetsPicker {
    constructor(readonly assetsForChain: Asset[]) {}

    getAssetByDenom(denom: string): Asset | undefined {
        return this.assetsForChain.find(({ base, denom_units, display }) => {
            return (
                base === denom ||
                display === denom ||
                denom_units.find(({ denom: _denom }) => denom === _denom)
            );
        });
    }
}
