import Razorpay from "razorpay";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID as string,
  key_secret: process.env.RAZORPAY_KEY_SECRET as string,
});

export interface CreateOrderParams {
  amount: number; // Amount in smallest currency unit (e.g., paise)
  currency: string;
  receipt: string;
  notes?: Record<string, any>;
}

export async function createRazorpayOrder(params: CreateOrderParams) {
  const options = {
    amount: params.amount,
    currency: params.currency,
    receipt: params.receipt,
    notes: params.notes || {},
  };
  return razorpay.orders.create(options);
}
