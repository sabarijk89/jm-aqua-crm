import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as express from 'express';
import * as cors from 'cors';

// Initialize Firebase Admin SDK
// It's important to initialize admin only once
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const app = express();

// Automatically allow cross-origin requests
app.use(cors({ origin: true }));
app.use(express.json()); // Middleware to parse JSON bodies

// --- Helper function to handle errors ---
const handleError = (res: express.Response, error: any, message: string) => {
  console.error(message, error);
  res.status(500).send({ error: message });
};

// --- Entity Types (mirroring frontend types.ts for consistency) ---
// These would ideally be shared from a common types package, but for now, we'll redefine the necessary parts.
interface Customer {
  id?: string; // Firestore will generate ID, but it's good to have for responses
  name: string;
  phone: string;
  address: string;
  type: string; // CustomerType enum on frontend
  createdAt: string;
  gstin?: string;
}

interface Product {
  id?: string;
  name: string;
  price: number;
  initialStock: number;
  costPrice: number;
}

interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  itemTotal: number;
  unitCostPrice: number;
}

interface Order {
  id?: string;
  orderNumber: string;
  customerId: string;
  orderDate: string;
  items: OrderItem[];
  totalAmount: number;
  amountPaid: number;
  balanceAmount: number;
  paymentMode: string; // PaymentMode enum
  status: string; // OrderStatus enum
  deliveryNotes?: string;
  place?: string;
  totalCostPrice: number;
  estimatedProfit: number;
  emptyJarsReturned?: number;
}

interface Expense {
  id?: string;
  date: string;
  category: string; // ExpenseCategory enum
  description: string;
  amount: number;
  vendor?: string;
}


// --- Customers Endpoints ---
const CUSTOMERS_COLLECTION = 'customers';

// POST /customers - Create a new customer
app.post('/customers', async (req, res) => {
  try {
    const customerData = req.body as Customer;
    // Basic validation (more can be added)
    if (!customerData.name || !customerData.phone || !customerData.address || !customerData.type || !customerData.createdAt) {
      return res.status(400).send({ error: 'Missing required customer fields.' });
    }
    const docRef = await db.collection(CUSTOMERS_COLLECTION).add(customerData);
    res.status(201).send({ id: docRef.id, ...customerData });
  } catch (error) {
    handleError(res, error, 'Failed to create customer.');
  }
});

// GET /customers - Retrieve a list of all customers
app.get('/customers', async (req, res) => {
  try {
    const snapshot = await db.collection(CUSTOMERS_COLLECTION).get();
    const customers: Customer[] = [];
    snapshot.forEach(doc => {
      customers.push({ id: doc.id, ...doc.data() } as Customer);
    });
    res.status(200).send(customers);
  } catch (error) {
    handleError(res, error, 'Failed to retrieve customers.');
  }
});

// GET /customers/{id} - Retrieve a single customer
app.get('/customers/:id', async (req, res) => {
  try {
    const customerId = req.params.id;
    const doc = await db.collection(CUSTOMERS_COLLECTION).doc(customerId).get();
    if (!doc.exists) {
      return res.status(404).send({ error: 'Customer not found.' });
    }
    res.status(200).send({ id: doc.id, ...doc.data() });
  } catch (error) {
    handleError(res, error, 'Failed to retrieve customer.');
  }
});

// PUT /customers/{id} - Update a customer
app.put('/customers/:id', async (req, res) => {
  try {
    const customerId = req.params.id;
    const customerData = req.body as Partial<Customer>; // Allow partial updates

    // Ensure no one tries to update the ID via body
    if (customerData.id) {
        delete customerData.id;
    }

    const docRef = db.collection(CUSTOMERS_COLLECTION).doc(customerId);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).send({ error: 'Customer not found to update.' });
    }
    await docRef.update(customerData);
    res.status(200).send({ id: customerId, ...customerData }); // Send back the merged data
  } catch (error) {
    handleError(res, error, 'Failed to update customer.');
  }
});

// DELETE /customers/{id} - Delete a customer
app.delete('/customers/:id', async (req, res) => {
  try {
    const customerId = req.params.id;
    const docRef = db.collection(CUSTOMERS_COLLECTION).doc(customerId);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).send({ error: 'Customer not found to delete.' });
    }
    await docRef.delete();
    res.status(200).send({ message: 'Customer deleted successfully.' });
  } catch (error) {
    handleError(res, error, 'Failed to delete customer.');
  }
});

// --- Orders Endpoints ---
const ORDERS_COLLECTION = 'orders';

// POST /orders - Create a new order
app.post('/orders', async (req, res) => {
  try {
    const orderData = req.body as Order;
    // Basic validation
    if (!orderData.customerId || !orderData.orderDate || !orderData.items || orderData.items.length === 0) {
      return res.status(400).send({ error: 'Missing required order fields.' });
    }
    const docRef = await db.collection(ORDERS_COLLECTION).add(orderData);
    res.status(201).send({ id: docRef.id, ...orderData });
  } catch (error) {
    handleError(res, error, 'Failed to create order.');
  }
});

// GET /orders - Retrieve all orders
app.get('/orders', async (req, res) => {
  try {
    const snapshot = await db.collection(ORDERS_COLLECTION).get();
    const orders: Order[] = [];
    snapshot.forEach(doc => {
      orders.push({ id: doc.id, ...doc.data() } as Order);
    });
    res.status(200).send(orders);
  } catch (error) {
    handleError(res, error, 'Failed to retrieve orders.');
  }
});

// GET /orders/{id} - Retrieve a single order (Added for completeness, though not explicitly requested for GET by ID)
app.get('/orders/:id', async (req, res) => {
  try {
    const orderId = req.params.id;
    const doc = await db.collection(ORDERS_COLLECTION).doc(orderId).get();
    if (!doc.exists) {
      return res.status(404).send({ error: 'Order not found.' });
    }
    res.status(200).send({ id: doc.id, ...doc.data() });
  } catch (error) {
    handleError(res, error, 'Failed to retrieve order.');
  }
});


// PUT /orders/{id} - Update an order
app.put('/orders/:id', async (req, res) => {
  try {
    const orderId = req.params.id;
    const orderData = req.body as Partial<Order>;
    if (orderData.id) {
        delete orderData.id;
    }
    const docRef = db.collection(ORDERS_COLLECTION).doc(orderId);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).send({ error: 'Order not found to update.' });
    }
    await docRef.update(orderData);
    res.status(200).send({ id: orderId, ...orderData });
  } catch (error) {
    handleError(res, error, 'Failed to update order.');
  }
});

// DELETE /orders/{id} - Delete an order
app.delete('/orders/:id', async (req, res) => {
  try {
    const orderId = req.params.id;
    const docRef = db.collection(ORDERS_COLLECTION).doc(orderId);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).send({ error: 'Order not found to delete.' });
    }
    await docRef.delete();
    res.status(200).send({ message: 'Order deleted successfully.' });
  } catch (error) {
    handleError(res, error, 'Failed to delete order.');
  }
});

// --- Products Endpoints ---
const PRODUCTS_COLLECTION = 'products';

// POST /products - Create a new product
app.post('/products', async (req, res) => {
  try {
    const productData = req.body as Product;
    if (!productData.name || typeof productData.price !== 'number' || typeof productData.initialStock !== 'number' || typeof productData.costPrice !== 'number') {
        return res.status(400).send({ error: 'Missing or invalid product fields.' });
    }
    const docRef = await db.collection(PRODUCTS_COLLECTION).add(productData);
    res.status(201).send({ id: docRef.id, ...productData });
  } catch (error) {
    handleError(res, error, 'Failed to create product.');
  }
});

// GET /products - Retrieve all products
app.get('/products', async (req, res) => {
  try {
    const snapshot = await db.collection(PRODUCTS_COLLECTION).get();
    const products: Product[] = [];
    snapshot.forEach(doc => {
      products.push({ id: doc.id, ...doc.data() } as Product);
    });
    res.status(200).send(products);
  } catch (error) {
    handleError(res, error, 'Failed to retrieve products.');
  }
});

// GET /products/{id} - Retrieve a single product (Added for completeness)
app.get('/products/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    const doc = await db.collection(PRODUCTS_COLLECTION).doc(productId).get();
    if (!doc.exists) {
      return res.status(404).send({ error: 'Product not found.' });
    }
    res.status(200).send({ id: doc.id, ...doc.data() });
  } catch (error) {
    handleError(res, error, 'Failed to retrieve product.');
  }
});

// PUT /products/{id} - Update a product
app.put('/products/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    const productData = req.body as Partial<Product>;
     if (productData.id) {
        delete productData.id;
    }
    const docRef = db.collection(PRODUCTS_COLLECTION).doc(productId);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).send({ error: 'Product not found to update.' });
    }
    await docRef.update(productData);
    res.status(200).send({ id: productId, ...productData });
  } catch (error) {
    handleError(res, error, 'Failed to update product.');
  }
});

// DELETE /products/{id} - Delete a product (Added for completeness, though not in original list for products)
app.delete('/products/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    const docRef = db.collection(PRODUCTS_COLLECTION).doc(productId);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).send({ error: 'Product not found to delete.' });
    }
    await docRef.delete();
    res.status(200).send({ message: 'Product deleted successfully.' });
  } catch (error) {
    handleError(res, error, 'Failed to delete product.');
  }
});


// --- Expenses Endpoints ---
const EXPENSES_COLLECTION = 'expenses';

// POST /expenses - Create a new expense
app.post('/expenses', async (req, res) => {
  try {
    const expenseData = req.body as Expense;
    if (!expenseData.date || !expenseData.category || !expenseData.description || typeof expenseData.amount !== 'number') {
        return res.status(400).send({ error: 'Missing or invalid expense fields.' });
    }
    const docRef = await db.collection(EXPENSES_COLLECTION).add(expenseData);
    res.status(201).send({ id: docRef.id, ...expenseData });
  } catch (error) {
    handleError(res, error, 'Failed to create expense.');
  }
});

// GET /expenses - Retrieve all expenses
app.get('/expenses', async (req, res) => {
  try {
    const snapshot = await db.collection(EXPENSES_COLLECTION).get();
    const expenses: Expense[] = [];
    snapshot.forEach(doc => {
      expenses.push({ id: doc.id, ...doc.data() } as Expense);
    });
    res.status(200).send(expenses);
  } catch (error) {
    handleError(res, error, 'Failed to retrieve expenses.');
  }
});

// GET /expenses/{id} - Retrieve a single expense (Added for completeness)
app.get('/expenses/:id', async (req, res) => {
  try {
    const expenseId = req.params.id;
    const doc = await db.collection(EXPENSES_COLLECTION).doc(expenseId).get();
    if (!doc.exists) {
      return res.status(404).send({ error: 'Expense not found.' });
    }
    res.status(200).send({ id: doc.id, ...doc.data() });
  } catch (error) {
    handleError(res, error, 'Failed to retrieve expense.');
  }
});


// PUT /expenses/{id} - Update an expense
app.put('/expenses/:id', async (req, res) => {
  try {
    const expenseId = req.params.id;
    const expenseData = req.body as Partial<Expense>;
    if (expenseData.id) {
        delete expenseData.id;
    }
    const docRef = db.collection(EXPENSES_COLLECTION).doc(expenseId);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).send({ error: 'Expense not found to update.' });
    }
    await docRef.update(expenseData);
    res.status(200).send({ id: expenseId, ...expenseData });
  } catch (error) {
    handleError(res, error, 'Failed to update expense.');
  }
});

// DELETE /expenses/{id} - Delete an expense
app.delete('/expenses/:id', async (req, res) => {
  try {
    const expenseId = req.params.id;
    const docRef = db.collection(EXPENSES_COLLECTION).doc(expenseId);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).send({ error: 'Expense not found to delete.' });
    }
    await docRef.delete();
    res.status(200).send({ message: 'Expense deleted successfully.' });
  } catch (error) {
    handleError(res, error, 'Failed to delete expense.');
  }
});

// Expose Express API as a single Cloud Function:
export const api = functions.https.onRequest(app);

// Additionally, it's good practice to update the `main` and `engines` field in functions/package.json
// The `main` should point to `lib/src/index.js` (the compiled output)
// `engines` should specify the node version e.g. "node": "18"
// This will be done in a subsequent step.
// Also, a "build" script like "tsc" should be added to package.json scripts.
// And a "serve" script like "firebase emulators:start --only functions"
// And a "deploy" script like "firebase deploy --only functions"
// These are more for local development and deployment, which I can't fully do here.
// For now, the core logic is in index.ts.
