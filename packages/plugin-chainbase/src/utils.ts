import { TokenWithBalance } from "./types";

export function formatTokenBalance(token: TokenWithBalance) {
    const balanceDecimal = BigInt(`0x${token.balance}`);
    const amount = token.decimals
        ? Number(balanceDecimal) / Math.pow(10, token.decimals)
        : Number(balanceDecimal);

    const formattedAmount =
        amount >= 1
            ? amount.toFixed(6).replace(/\.?0+$/, "")
            : amount.toString();

    const name =
        token.symbol.length > token.name.length ? token.name : token.symbol;
    return `${formattedAmount} ${name}`;
}
