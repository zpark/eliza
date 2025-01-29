import { AxiosResponse } from "axios";
import { PlaceOrderRequest } from "../types"
import axios from "axios";


export const placeOrder = async (
    endpoint: string,
    jwt: string,
    order: PlaceOrderRequest,
): Promise<AxiosResponse> => {
    const response = await axios.post(
        `${endpoint}/v2/place-order`,
        order,
        {
            headers: {
                authorization: `Bearer ${jwt}`,
                "content-type": "application/json",
            },
        }
    );
    return response;
}