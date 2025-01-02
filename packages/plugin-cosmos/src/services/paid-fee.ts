import type {
    DeliverTxResponse,
    ExecuteResult,
} from "@cosmjs/cosmwasm-stargate";

interface EventToGetGasFrom {
    eventName: string;
    attributeType: string;
}

export class PaidFee {
    constructor(readonly eventsToPickGasFor: EventToGetGasFrom[]) {}

    static getInstanceWithDefaultEvents() {
        return new PaidFee([
            { eventName: "fee_pay", attributeType: "fee" },
            { eventName: "tip_refund", attributeType: "tip" },
        ]);
    }

    getPaidFeeFromReceipt(receipt: ExecuteResult | DeliverTxResponse): number {
        const selectedEvents = receipt.events.filter(({ type }) =>
            this.eventsToPickGasFor
                .map(({ eventName }) => eventName)
                .includes(type)
        );

        return selectedEvents.reduce<number>((acc, { attributes }) => {
            return (
                acc +
                attributes.reduce<number>((_acc, { key, value }) => {
                    if (
                        this.eventsToPickGasFor.some(
                            ({ attributeType }) => attributeType === key
                        )
                    ) {
                        const testValue = value.match(/\d+/)?.[0];
                        const testValueAsNumber = Number(testValue);

                        if (Number.isNaN(testValueAsNumber)) {
                            return _acc;
                        }

                        _acc = _acc + testValueAsNumber;

                        return _acc;
                    }

                    return _acc;
                }, 0)
            );
        }, 0);
    }
}
