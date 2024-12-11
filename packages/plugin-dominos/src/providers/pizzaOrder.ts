import { IAgentRuntime, Memory, Provider } from "@ai16z/eliza";
import { OrderStatus } from "../types";
import { PizzaOrderManager } from "../PizzaOrderManager";

export const pizzaOrderProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory) => {
        const orderManager = new PizzaOrderManager(runtime);

        const userId = message.userId;
        const order = await orderManager.getOrder(userId);
        const customer = await orderManager.getCustomer(userId);
        if (!order) {
            return "No active pizza order. The customer needs to start a new order.";
        }

        let context = "=== PIZZA ORDER STATUS ===\n\n";

        // Add order summary
        context += orderManager.getOrderSummary(order, customer);

        // Add next required action
        context += "\nNEXT REQUIRED ACTION:\n";
        context += orderManager.getNextRequiredAction(order, customer);

        // Add store status
        context += "\n\nSTORE STATUS:\n";
        context += `Store Open: ${orderManager.availability.isStoreOpen ? "Yes" : "No"}\n`;
        context += `Delivery Available: ${orderManager.availability.isDeliveryAvailable ? "Yes" : "No"}\n`;
        context += `Carryout Available: ${orderManager.availability.isCarryoutAvailable ? "Yes" : "No"}\n`;

        // Add order status
        context += "\nORDER STATUS:\n";
        context += `Current Status: ${order.status}\n`;
        if (order.status === OrderStatus.CONFIRMED) {
            context += "Order is confirmed and being prepared.\n";
        } else if (order.status === OrderStatus.PROCESSING) {
            context += "Order is being processed but needs confirmation.\n";
        }

        console.log("Order context:\n", context);

        return context;
    },
};
