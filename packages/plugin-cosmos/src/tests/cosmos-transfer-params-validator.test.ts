import { describe, it, expect, vi } from "vitest";
import { TransferActionParamsValidator } from "../services/cosmos-transfer-params-validator";
import { elizaLogger } from "@ai16z/eliza";

vi.mock("@ai16z/eliza", () => ({
    elizaLogger: {
        error: vi.fn(),
    },
}));

describe("TransferActionParamsValidator", () => {
    const validator = new TransferActionParamsValidator();

    it("should validate and return valid parameters", () => {
        const validParams = {
            denomOrIbc: "uatom",
            amount: "1000",
            toAddress: "cosmos1receiveraddress",
        };

        const result = validator.validate(validParams);

        expect(result).toEqual(validParams);
    });

    it("should log an error and return undefined for invalid parameters", () => {
        const invalidParams = {
            denomOrIbc: "uatom",
            amount: "1000",
            // Missing `toAddress`
        };

        const result = validator.validate(invalidParams);

        expect(result).toBeUndefined();
        expect(elizaLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('"issues":')
        );
        expect(elizaLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('"message":')
        );
    });

    it("should throw an error if input is completely invalid", () => {
        const completelyInvalidParams = null;

        const result = validator.validate(completelyInvalidParams);

        expect(result).toBeUndefined();
        expect(elizaLogger.error).toHaveBeenCalledWith(
            expect.stringContaining("Expected object")
        );
    });
});
