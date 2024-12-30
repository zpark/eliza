import { describe, it, expect } from "vitest";
import { AssetsPicker } from "../services/assets-picker";

describe("AssetsPicker", () => {
  const assetsForChain = [
    {
      base: "base1",
      denom_units: [
        { denom: "denom1", exponent: 0 },
        { denom: "denom1_display", exponent: 6 },
      ],
      display: "denom1_display",
    },
    {
      base: "base2",
      denom_units: [
        { denom: "denom2", exponent: 0 },
        { denom: "denom2_display", exponent: 6 },
      ],
      display: "denom2_display",
    },
  ];

  const assetsPicker = new AssetsPicker(assetsForChain);

  describe("getAssetByDenom", () => {
    it("should find an asset by its base denom", () => {
      const result = assetsPicker.getAssetByDenom("base1");

      expect(result).toEqual(assetsForChain[0]);
    });

    it("should find an asset by its display denom", () => {
      const result = assetsPicker.getAssetByDenom("denom2_display");

      expect(result).toEqual(assetsForChain[1]);
    });

    it("should find an asset by a denom unit", () => {
      const result = assetsPicker.getAssetByDenom("denom1");

      expect(result).toEqual(assetsForChain[0]);
    });

    it("should return undefined if no matching asset is found", () => {
      const result = assetsPicker.getAssetByDenom("nonexistent_denom");

      expect(result).toBeUndefined();
    });
  });
});
