import { describe, it, expect } from "vitest";
import { AssetsAdapter } from "../services/assets-adapter";
import { parseUnits } from "viem";

describe("AssetToChainOperationAdapter", () => {
  describe("calculateAssetAmountForChainOperation", () => {
    const mockAsset = {
      base: "base1",
      display: "denom1_display",
      denom_units: [
        { denom: "denom1", exponent: 0 },
        { denom: "denom1_display", exponent: 6 },
      ],
    };

    it("should correctly calculate the Coin for a valid denom and exponent", () => {
      const result = AssetsAdapter.amountToAmountInBaseDenom({
        asset: mockAsset,
        amount: "1000",
        denom: "denom1_display",
      });

      expect(result).toEqual({
        amount: parseUnits("1000", 6).toString(),
        denom: "base1",
      });
    });

    it("should throw an error if the denom is not found", () => {
      expect(() => {
        AssetsAdapter.amountToAmountInBaseDenom({
          asset: mockAsset,
          amount: "1000",
          denom: "nonexistent_denom",
        });
      }).toThrowError('Denom unit for "nonexistent_denom" not found');
    });

    it("should correctly handle numerical amounts", () => {
      const result = AssetsAdapter.amountToAmountInBaseDenom({
        asset: mockAsset,
        amount: 1234,
        denom: "denom1",
      });

      expect(result).toEqual({
        amount: parseUnits("1234", 0).toString(),
        denom: "base1",
      });
    });

    it("should handle a denom with exponent 0 correctly", () => {
      const result = AssetsAdapter.amountToAmountInBaseDenom({
        asset: mockAsset,
        amount: "5000",
        denom: "denom1",
      });

      expect(result).toEqual({
        amount: parseUnits("5000", 0).toString(),
        denom: "base1",
      });
    });
  });
});
