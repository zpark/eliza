import { AxiosResponse } from "axios";
import axios from "axios";

export const getSubaccountSummary = async (
    endpoint: string,
    jwt: string,
    subaccount: string
): Promise<AxiosResponse> => {
    return await axios.get(`${endpoint}/v2/subaccount-summary/${subaccount}`, {
        headers: {
            authorization: `Bearer ${jwt}`,
            "content-type": "application/json",
        },
    });
};
