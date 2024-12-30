import { parseUnits } from "viem";
import { Asset, Coin } from "../types";

export class AssetsAdapter {
  static amountToAmountInBaseDenom({
    amount,
    asset,
    denom,
  }: {
        asset: Asset;
        amount: string | number;
        denom: string;
    }): Coin {
    const denomUnit = asset.denom_units.find(
      ({ denom: _denom }) => _denom === denom
    );

    if (denomUnit === undefined) {
      throw new Error(`Denom unit for "${denom}" not found`);
    }

    return {
      amount: parseUnits(
        amount.toString(),
        denomUnit.exponent
      ).toString(),
      denom: asset.base,
    };
  }
}
