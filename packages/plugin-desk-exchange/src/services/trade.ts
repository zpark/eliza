import { AxiosResponse } from "axios";
import { CancelOrderRequest, PlaceOrderRequest } from "../types";
import axios from "axios";

export const placeOrder = async (
    endpoint: string,
    jwt: string,
    order: PlaceOrderRequest
): Promise<AxiosResponse> => {
    return await axios.post(`${endpoint}/v2/place-order`, order, {
        headers: {
            authorization: `Bearer ${jwt}`,
            "content-type": "application/json",
        },
    });
};

export const cancelOrder = async (
    endpoint: string,
    jwt: string,
    order: CancelOrderRequest
): Promise<AxiosResponse> => {
    return await axios.post(`${endpoint}/v2/cancel-order`, order, {
        headers: {
            authorization: `Bearer ${jwt}`,
            "content-type": "application/json",
        },
    });
};
