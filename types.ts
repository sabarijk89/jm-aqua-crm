

export enum CustomerType {
  SHOP = 'Shop',
  HOUSE = 'House',
}

export enum OrderStatus {
  PENDING = 'Pending',
  DISPATCHED = 'Dispatched',
  DELIVERED = 'Delivered',
  CANCELLED = 'Cancelled',
}

export enum PaymentMode {
  CASH = 'Cash',
  UPI = 'UPI',
  CARD = 'Card',
  PENDING = 'Payment Pending',
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  type: CustomerType;
  createdAt: string;
  gstin?: string; 
}

export interface Product {
  id: string;
  name: string;
  price: number; 
  initialStock: number; 
  costPrice: number; // New: Cost price of the product
}

export interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number; 
  itemTotal: number; 
  unitCostPrice: number; // New: Cost price of the product at the time of order
}

export interface Order {
  id:string;
  orderNumber: string;
  customerId: string;
  orderDate: string; 
  items: OrderItem[]; 
  totalAmount: number; 
  amountPaid: number;
  balanceAmount: number; 
  paymentMode: PaymentMode;
  status: OrderStatus;
  deliveryNotes?: string;
  place?: string; // New: Specific place for the order
  totalCostPrice: number; // New: Total cost of goods for this order
  estimatedProfit: number; // New: totalAmount - totalCostPrice
  emptyJarsReturned?: number; // Represents jars returned FOR THIS SPECIFIC ORDER. Cumulative balance will be calculated.
  // emptyJarsBalance?: number; // Removed - will be calculated dynamically
}

export interface StatSummary {
  deliveredOrders: number;
  pendingOrders: number; 
  totalCustomers: number;
  todaysSales: number;
  todaysIncome: number;
  todaysOrdersCount: number;
  scheduledOrdersCount: number; 
  todaysExpenses: number;
  thisMonthExpenses: number;
  thisMonthSales: number;
  thisMonthIncome: number;
  totalEstimatedProfit: number; // New
  thisMonthEstimatedProfit: number; // New
}

export interface OrderFormData {
  customerId: string;
  orderDate: string; 
  items: OrderFormDataItem[];
  amountPaid: string; 
  paymentMode: PaymentMode;
  status: OrderStatus;
  deliveryNotes?: string;
  place?: string; // New: Specific place for the order
  emptyJarsReturned?: string; // Input for jars returned in this specific transaction
}

export interface OrderFormDataItem {
  productId: string;
  quantity: string;
}

export interface ProductFormData { // New: For Product Add/Edit Modal
  name: string;
  price: string;
  costPrice: string;
  initialStock: string;
}

// Expense Tracking
export enum ExpenseCategory {
  RAW_MATERIAL = 'Raw Material', 
  OPERATIONAL = 'Operational',   
  MAINTENANCE = 'Maintenance',   
  CAPITAL = 'Capital',         
  MISCELLANEOUS = 'Miscellaneous', 
}

export interface Expense {
  id: string;
  date: string; 
  category: ExpenseCategory;
  description: string;
  amount: number;
  vendor?: string;
}

export interface ExpenseFormData {
  date: string; 
  category: ExpenseCategory;
  description: string;
  amount: string; 
  vendor?: string;
}

export type InventoryData = Record<string, number>;