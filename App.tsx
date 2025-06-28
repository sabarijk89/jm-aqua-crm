
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode'; // Import QRCode
import { 
    Customer, Order, OrderItem, CustomerType, OrderStatus, PaymentMode, Product as ProductType, 
    StatSummary, OrderFormData, OrderFormDataItem,
    Expense, ExpenseCategory, ExpenseFormData, ProductFormData, InventoryData
} from './types';
import { 
    APP_NAME, COMPANY_NAME, INITIAL_PRODUCTS, ICONS, 
    MOCK_CUSTOMERS_COUNT, MOCK_ORDERS_COUNT, MOCK_EXPENSES_COUNT, 
    EXPENSE_CATEGORY_OPTIONS
} from './constants';
import Modal from './components/Modal';
// Removed: import { generateBusinessInsights, generateDailyBriefing } from './services/geminiService';
import InvoicePage from './invoice'; 
import CustomerLedgerPage from './CustomerLedgerPage';

// LocalStorage Keys
const LOCAL_STORAGE_KEYS = {
  CUSTOMERS: 'jmAquaCrmCustomers',
  ORDERS: 'jmAquaCrmOrders',
  INVENTORY: 'jmAquaCrmInventory',
  EXPENSES: 'jmAquaCrmExpenses',
  PRODUCTS_DATA: 'jmAquaCrmProductsData', 
  // ALL_DATA_BACKUP can be used for a single key if preferred, but individual keys are fine for now.
};

interface AllCrmData {
  customers: Customer[];
  orders: Order[];
  productsData: ProductType[];
  inventory: Record<string, number>;
  expenses: Expense[];
}

// Dummy UPI ID - User should replace this
const DUMMY_UPI_ID = 'yourupiaddress@okhdfcbank'; 

// Mock Data Generation
const generateMockId = () => Math.random().toString(36).substr(2, 9);

const generateMockCustomers = (count: number): Customer[] => {
  const types = Object.values(CustomerType);
  return Array.from({ length: count }, (_, i) => ({
    id: generateMockId(),
    name: `Customer ${i + 1}`,
    phone: `9876543${String(i).padStart(3, '0')}`,
    address: `${i + 1} Mockingbird Lane, Cityville`,
    type: types[i % types.length],
    createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    gstin: Math.random() > 0.5 ? `33ABCDE${String(i).padStart(4,'0')}F1Z${i%10}` : undefined,
  }));
};

const generateMockOrders = (count: number, customers: Customer[], products: ProductType[]): Order[] => {
  const statuses = Object.values(OrderStatus);
  const paymentModes = Object.values(PaymentMode);
  return Array.from({ length: count }, (_, i) => {
    const numItems = Math.random() > 0.7 ? Math.floor(Math.random() * 2) + 2 : 1; 
    const orderItems: OrderItem[] = [];
    const usedProductIds = new Set<string>();
    let currentTotalCostPrice = 0;

    for (let j = 0; j < numItems; j++) {
      let product;
      if (products.length === 0) break; 
      do {
        product = products[Math.floor(Math.random() * products.length)];
      } while (product && usedProductIds.has(product.id) && usedProductIds.size < products.length);
      
      if (!product || (usedProductIds.has(product.id) && usedProductIds.size >= products.length)) {
          if(products.length > 0 && !product) product = products[0]; 
          else if (!product) continue; 
      }
      usedProductIds.add(product.id);
      
      const quantity = Math.floor(Math.random() * 3) + 1; 
      orderItems.push({
        productId: product.id,
        quantity,
        unitPrice: product.price,
        itemTotal: product.price * quantity,
        unitCostPrice: product.costPrice, 
      });
      currentTotalCostPrice += product.costPrice * quantity;
    }
    
    const totalAmount = orderItems.reduce((sum, item) => sum + item.itemTotal, 0);
    let amountPaid = 0;
    let status = statuses[i % statuses.length];

    if (status === OrderStatus.DELIVERED) {
      amountPaid = Math.random() > 0.1 ? totalAmount : Math.floor(Math.random() * totalAmount);
    } else if (status === OrderStatus.DISPATCHED) {
      amountPaid = Math.random() > 0.5 ? Math.floor(Math.random() * totalAmount) : 0;
    } else { 
      amountPaid = 0;
    }
    if (status === OrderStatus.CANCELLED) amountPaid = 0;

    let orderDate = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000); // Past date with time
    if (i % 5 === 0 && status === OrderStatus.PENDING) { 
      // Future date with current time component from when this mock data is generated
      const futureDatePart = new Date(Date.now() + (Math.floor(Math.random() * 14) + 1) * 24 * 60 * 60 * 1000);
      const currentTimePart = new Date().toTimeString().split(' ')[0]; // HH:MM:SS
      orderDate = new Date(`${futureDatePart.toISOString().split('T')[0]}T${currentTimePart}`);
    } else if (i % 3 === 0) { // Some orders on current day with current time
        orderDate = new Date();
    }


    const estimatedProfit = totalAmount - currentTotalCostPrice;
    
    let emptyCansReturnedMock: number | undefined = undefined;
    const twentyLitreCanProductDetails = products.find(p => p.name.toLowerCase() === '20l can'); // Changed to can
    if (twentyLitreCanProductDetails) {
        const twentyLitreCanItemInOrder = orderItems.find(item => item.productId === twentyLitreCanProductDetails.id);
        if (twentyLitreCanItemInOrder) {
            emptyCansReturnedMock = Math.floor(Math.random() * (twentyLitreCanItemInOrder.quantity + 1));
        }
    }

    return {
      id: generateMockId(),
      orderNumber: `ORD-${String(Date.now()).slice(-4)}-${String(i).padStart(4, '0')}`,
      customerId: customers.length > 0 ? customers[i % customers.length].id : 'N/A',
      orderDate: orderDate.toISOString(),
      items: orderItems,
      totalAmount,
      amountPaid,
      balanceAmount: totalAmount - amountPaid,
      paymentMode: paymentModes[i % paymentModes.length],
      status: status,
      deliveryNotes: Math.random() > 0.7 ? `Special instruction ${i}` : undefined,
      place: Math.random() > 0.8 ? `Hall ${String.fromCharCode(65 + (i % 5))}` : undefined, 
      totalCostPrice: currentTotalCostPrice,
      estimatedProfit: estimatedProfit,
      emptyJarsReturned: emptyCansReturnedMock, // Kept key as emptyJarsReturned for now due to type, but logic uses 'can'
    };
  });
};

const generateMockExpenses = (count: number): Expense[] => {
  const categories = Object.values(ExpenseCategory);
  const descriptions = {
    [ExpenseCategory.RAW_MATERIAL]: ["PET Bottles 500ml", "Bottle Caps (Blue)", "Cover Rolls (Printed)"],
    [ExpenseCategory.OPERATIONAL]: ["Team Tea & Snacks", "Office Stationery", "Printer Ink"],
    [ExpenseCategory.MAINTENANCE]: ["Machine Bearing Replacement", "Electrician Visit - Wiring", "Filter Change Service"],
    [ExpenseCategory.CAPITAL]: ["New Sealing Machine", "Office Laptop Purchase", "Delivery Van Downpayment"],
    [ExpenseCategory.MISCELLANEOUS]: ["Unexpected Courier Charges", "Local Festival Contribution", "Cleaning Supplies"]
  };
  const vendors = ["Shree Polymers", "Local Groceries", "Baba Services", "Modern Machines Co.", "City Couriers"];

  return Array.from({ length: count }, (_, i) => {
    const category = categories[i % categories.length];
    const descriptionList = descriptions[category];
    return {
      id: generateMockId(),
      date: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString(), 
      category,
      description: descriptionList[Math.floor(Math.random() * descriptionList.length)],
      amount: Math.floor(Math.random() * 5000) + 100, 
      vendor: Math.random() > 0.3 ? vendors[Math.floor(Math.random() * vendors.length)] : undefined,
    };
  });
};


// Helper components defined at top level
interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string; 
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color }) => (
  <div className="bg-white p-4 rounded-xl shadow-lg flex items-center space-x-4 transition-all hover:shadow-xl">
    <div className={`p-3 rounded-full ${color} flex items-center justify-center`}>
      {icon}
    </div>
    <div>
      <p className="text-sm text-slate-500 font-medium">{title}</p>
      <p className="text-xl font-semibold text-slate-800">{value}</p>
    </div>
  </div>
);


interface CustomerFormData {
  name: string;
  phone: string;
  address: string;
  type: CustomerType;
  gstin?: string;
}

const isDateToday = (dateString: string): boolean => {
  const date = new Date(dateString);
  const today = new Date();
  return date.getFullYear() === today.getFullYear() &&
         date.getMonth() === today.getMonth() &&
         date.getDate() === today.getDate();
};

const isDateThisMonth = (dateString: string): boolean => {
    const date = new Date(dateString);
    const today = new Date();
    return date.getFullYear() === today.getFullYear() &&
           date.getMonth() === today.getMonth();
};

const isFutureDate = (dateString: string): boolean => {
  const orderDate = new Date(dateString);
  const today = new Date();
  orderDate.setHours(0, 0, 0, 0); 
  today.setHours(0, 0, 0, 0);     
  return orderDate > today;
};

const isDateTodayOrPast = (dateString: string): boolean => {
  const orderDate = new Date(dateString);
  const today = new Date();
  orderDate.setHours(0, 0, 0, 0); 
  today.setHours(0, 0, 0, 0);     
  return orderDate <= today;
};

const isSameDay = (isoDateString: string, filterDateString: string): boolean => {
  if (!filterDateString) return true; 
  const orderDate = new Date(isoDateString);
  const filterDateParts = filterDateString.split('-'); 
  const filterDate = new Date(parseInt(filterDateParts[0]), parseInt(filterDateParts[1]) - 1, parseInt(filterDateParts[2]));
  
  return orderDate.getFullYear() === filterDate.getFullYear() &&
         orderDate.getMonth() === filterDate.getMonth() &&
         orderDate.getDate() === filterDate.getDate();
};

interface PageWrapperProps {
  title: string;
  children: React.ReactNode;
  showAddButton?: boolean;
  onAdd?: () => void;
  addButtonLabel?: string;
  showSearch?: boolean;
  searchTerm?: string;
  onSearchTermChange?: (term: string) => void;
  showOrderStatusFilter?: boolean;
  orderStatusFilter?: OrderStatus | 'All';
  onOrderStatusFilterChange?: (status: OrderStatus | 'All') => void;
  showDateFilter?: boolean;
  dateFilterValue?: string;
  onDateFilterChange?: (date: string) => void;
  onClearDateFilter?: () => void;
  showExpenseCategoryFilter?: boolean;
  expenseCategoryFilterValue?: ExpenseCategory | 'All';
  onExpenseCategoryFilterChange?: (category: ExpenseCategory | 'All') => void;
  showExportButton?: boolean; 
  onExport?: () => void;      
  exportButtonLabel?: string; 
  exportDisabled?: boolean;   
}

const PageWrapper: React.FC<PageWrapperProps> = 
({ 
  title, children, showAddButton, onAdd, addButtonLabel = "Add New", showSearch = true,
  searchTerm: externalSearchTerm, onSearchTermChange, 
  showOrderStatusFilter = false, orderStatusFilter: externalOrderStatusFilter, onOrderStatusFilterChange,
  showDateFilter = false, dateFilterValue, onDateFilterChange, onClearDateFilter,
  showExpenseCategoryFilter = false, expenseCategoryFilterValue, onExpenseCategoryFilterChange,
  showExportButton = false, onExport, exportButtonLabel = "Export", exportDisabled = false,
}) => (
  <div className="p-6">
    <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 page-wrapper-header">
      <h1 className="text-3xl font-bold text-slate-800">{title}</h1>
      <div className="flex flex-col sm:flex-row flex-wrap items-center gap-2 w-full sm:w-auto">
        {showSearch && onSearchTermChange && ( 
          <input 
            type="text"
            placeholder="Search..."
            className="px-4 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-brandBlue focus:border-brandBlue w-full sm:w-auto sm:max-w-xs"
            value={externalSearchTerm || ''} 
            onChange={(e) => onSearchTermChange(e.target.value)} 
            aria-label="Search all content"
          />
        )}
        {showOrderStatusFilter && onOrderStatusFilterChange && (  
          <select
            value={externalOrderStatusFilter || 'All'} 
            onChange={(e) => onOrderStatusFilterChange(e.target.value as OrderStatus | 'All')} 
            className="px-4 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-brandBlue focus:border-brandBlue bg-white text-slate-700 w-full sm:w-auto"
            aria-label="Filter orders by status"
          >
            <option value="All">All Statuses</option>
            {Object.values(OrderStatus).map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        )}
        {showExpenseCategoryFilter && onExpenseCategoryFilterChange && (
           <select
            value={expenseCategoryFilterValue}
            onChange={(e) => onExpenseCategoryFilterChange(e.target.value as ExpenseCategory | 'All')}
            className="px-4 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-brandBlue focus:border-brandBlue bg-white text-slate-700 w-full sm:w-auto"
            aria-label="Filter expenses by category"
          >
            <option value="All">All Categories</option>
            {Object.values(ExpenseCategory).map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        )}
         {showDateFilter && onDateFilterChange && onClearDateFilter && (
          <div className="flex items-center gap-1 w-full sm:w-auto">
            <input
              type="date"
              value={dateFilterValue}
              onChange={(e) => onDateFilterChange(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-brandBlue focus:border-brandBlue bg-white text-slate-700 w-full sm:w-auto"
              aria-label={`Filter by date for ${title}`}
            />
            {dateFilterValue && (
              <button
                onClick={onClearDateFilter}
                className="p-2 text-slate-500 hover:text-slate-700"
                title="Clear date filter"
                aria-label="Clear date filter"
              >
                {ICONS.close('w-4 h-4')}
              </button>
            )}
          </div>
        )}
        {showExportButton && onExport && (
          <button
            onClick={onExport}
            disabled={exportDisabled}
            className="bg-teal-500 hover:bg-teal-600 text-white font-semibold py-2 px-4 rounded-md shadow-md hover:shadow-lg transition duration-150 ease-in-out flex items-center justify-center gap-2 w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {ICONS.download()} {exportButtonLabel}
          </button>
        )}
        {showAddButton && onAdd && (
          <button
            onClick={onAdd}
            className="bg-brandBlue hover:bg-brandBlue-dark text-white font-semibold py-2 px-4 rounded-md shadow-md hover:shadow-lg transition duration-150 ease-in-out flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            {ICONS.add()} {addButtonLabel}
          </button>
        )}
      </div>
    </div>
    {children}
  </div>
);


export const App: React.FC = () => {
  const [productsData, setProductsData] = useState<ProductType[]>([]); 
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryData>({});
  const [expenses, setExpenses] = useState<Expense[]>([]); 
  
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerFormData, setCustomerFormData] = useState<CustomerFormData>({ name: '', phone: '', address: '', type: CustomerType.HOUSE, gstin: '' });

  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const initialOrderFormDataItem: OrderFormDataItem = { productId: '', quantity: '1' };
  const initialOrderFormData: OrderFormData = { 
    customerId: '', 
    orderDate: new Date().toISOString().split('T')[0], 
    items: [initialOrderFormDataItem], 
    amountPaid: '0', 
    paymentMode: PaymentMode.PENDING, 
    status: OrderStatus.PENDING, 
    deliveryNotes: '',
    place: '',
    emptyJarsReturned: '', // Field name remains emptyJarsReturned as per type, logic uses "can"
  };
  const [orderFormData, setOrderFormData] = useState<OrderFormData>(initialOrderFormData);
  const [upiQrCodeUrl, setUpiQrCodeUrl] = useState<string | null>(null); // For UPI QR Code

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const initialExpenseFormData: ExpenseFormData = {
    date: new Date().toISOString().split('T')[0], 
    category: ExpenseCategory.MISCELLANEOUS,
    description: '',
    amount: '',
    vendor: '',
  };
  const [expenseFormData, setExpenseFormData] = useState<ExpenseFormData>(initialExpenseFormData);

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductType | null>(null);
  const initialProductFormData: ProductFormData = { name: '', price: '', costPrice: '', initialStock: '' };
  const [productFormData, setProductFormData] = useState<ProductFormData>(initialProductFormData);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<OrderStatus | 'All'>('All');
  const [orderDateFilter, setOrderDateFilter] = useState<string>(''); 
  const [futureOrderDateFilter, setFutureOrderDateFilter] = useState<string>(''); 

  const [isAddingCustomerFromOrder, setIsAddingCustomerFromOrder] = useState(false);
  const [justAddedCustomerId, setJustAddedCustomerId] = useState<string | null>(null);

  const [isImportConfirmationModalOpen, setIsImportConfirmationModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dataToImport, setDataToImport] = useState<AllCrmData | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge'); // New state for import mode

  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [confirmationAction, setConfirmationAction] = useState<(() => void) | null>(null);
  const [confirmationTitle, setConfirmationTitle] = useState('Confirm Action');
  const [confirmationMessage, setConfirmationMessage] = useState('');

  const openConfirmationModal = (title: string, message: string, onConfirm: () => void) => {
    setConfirmationTitle(title);
    setConfirmationMessage(message);
    setConfirmationAction(() => onConfirm);
    setIsConfirmationModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (confirmationAction) {
        confirmationAction();
    }
    closeConfirmationModal();
  };

  const closeConfirmationModal = () => {
    setIsConfirmationModalOpen(false);
    setConfirmationAction(null);
    setConfirmationMessage('');
    setConfirmationTitle('Confirm Action');
  };

  const loadAllData = (data: AllCrmData) => {
    setCustomers(data.customers || []);
    setOrders(data.orders || []);
    setProductsData(data.productsData || []);
    setInventory(data.inventory || {});
    setExpenses(data.expenses || []);
  };
  
  useEffect(() => {
    let initialCustomers: Customer[] = [];
    let initialOrdersList: Order[] = [];
    let initialExpensesList: Expense[] = [];
    let initialProductsList: ProductType[] = [];
    
    const storedProductsStr = localStorage.getItem(LOCAL_STORAGE_KEYS.PRODUCTS_DATA);
    if (storedProductsStr) {
      try {
        initialProductsList = JSON.parse(storedProductsStr);
        if (!Array.isArray(initialProductsList)) throw new Error("Stored products data not an array");
      } catch (e) {
        console.error("Error parsing products data, falling back to seed.", e);
        initialProductsList = [...INITIAL_PRODUCTS]; 
      }
    } else {
      initialProductsList = [...INITIAL_PRODUCTS]; 
    }
    setProductsData(initialProductsList);
    
    const storedCustomersStr = localStorage.getItem(LOCAL_STORAGE_KEYS.CUSTOMERS);
    const storedOrdersStr = localStorage.getItem(LOCAL_STORAGE_KEYS.ORDERS);
    const storedExpensesStr = localStorage.getItem(LOCAL_STORAGE_KEYS.EXPENSES);

    if (storedCustomersStr) {
      try {
        initialCustomers = JSON.parse(storedCustomersStr);
        if (!Array.isArray(initialCustomers)) throw new Error("Stored customer data is not an array");
      } catch (e) {
        console.error("Error parsing customer data, falling back to mock data.", e);
        initialCustomers = generateMockCustomers(MOCK_CUSTOMERS_COUNT);
      }
    } else {
      initialCustomers = generateMockCustomers(MOCK_CUSTOMERS_COUNT);
    }
    setCustomers(initialCustomers);

    if (storedOrdersStr) {
      try {
        initialOrdersList = JSON.parse(storedOrdersStr);
        if (!Array.isArray(initialOrdersList)) throw new Error("Stored order data is not an array");
      } catch (e) {
        console.error("Error parsing order data, falling back to mock data.", e);
        initialOrdersList = generateMockOrders(MOCK_ORDERS_COUNT, initialCustomers, initialProductsList);
      }
    } else {
      initialOrdersList = generateMockOrders(MOCK_ORDERS_COUNT, initialCustomers, initialProductsList);
    }
    setOrders(initialOrdersList);

    if (storedExpensesStr) {
        try {
            initialExpensesList = JSON.parse(storedExpensesStr);
             if (!Array.isArray(initialExpensesList)) throw new Error("Stored expense data is not an array");
        } catch (e) {
            console.error("Error parsing expense data, falling back to mock data.", e);
            initialExpensesList = generateMockExpenses(MOCK_EXPENSES_COUNT);
        }
    } else {
        initialExpensesList = generateMockExpenses(MOCK_EXPENSES_COUNT);
    }
    setExpenses(initialExpensesList);

    let finalInventory: InventoryData;
    const storedInventoryStr = localStorage.getItem(LOCAL_STORAGE_KEYS.INVENTORY);

    if (storedInventoryStr) {
      try {
        const storedInventory = JSON.parse(storedInventoryStr);
        if (typeof storedInventory === 'object' && storedInventory !== null && Object.keys(storedInventory).length > 0) {
          finalInventory = storedInventory;
           initialProductsList.forEach(p => { 
            if (!(p.id in finalInventory)) {
              finalInventory[p.id] = p.initialStock; 
            }
          });
        } else {
          throw new Error("Invalid stored inventory");
        }
      } catch (e) {
        console.error("Error parsing inventory from localStorage or inventory was invalid, recalculating.", e);
        const baseInv = initialProductsList.reduce((acc, product) => {
          acc[product.id] = product.initialStock;
          return acc;
        }, {} as InventoryData);
        
        finalInventory = { ...baseInv };
        initialOrdersList.forEach(order => {
          if (order.status === OrderStatus.DELIVERED) {
            order.items.forEach(item => {
              finalInventory[item.productId] = (finalInventory[item.productId] || 0) - item.quantity;
            });
          }
        });
      }
    } else {
      const baseInv = initialProductsList.reduce((acc, product) => {
        acc[product.id] = product.initialStock;
        return acc;
      }, {} as InventoryData);
      
      finalInventory = { ...baseInv };
      initialOrdersList.forEach(order => {
        if (order.status === OrderStatus.DELIVERED) {
          order.items.forEach(item => {
            finalInventory[item.productId] = (finalInventory[item.productId] || 0) - item.quantity;
          });
        }
      });
    }
    setInventory(finalInventory);

  }, []); 

  useEffect(() => {
    if (productsData.length > 0 || localStorage.getItem(LOCAL_STORAGE_KEYS.PRODUCTS_DATA)) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.PRODUCTS_DATA, JSON.stringify(productsData));
    }
  }, [productsData]);

  useEffect(() => {
    if (customers.length > 0 || localStorage.getItem(LOCAL_STORAGE_KEYS.CUSTOMERS)) {
       localStorage.setItem(LOCAL_STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
    }
  }, [customers]);

  useEffect(() => {
    if (orders.length > 0 || localStorage.getItem(LOCAL_STORAGE_KEYS.ORDERS)) {
        localStorage.setItem(LOCAL_STORAGE_KEYS.ORDERS, JSON.stringify(orders));
    }
  }, [orders]);

  useEffect(() => {
     if (Object.keys(inventory).length > 0 || localStorage.getItem(LOCAL_STORAGE_KEYS.INVENTORY)) {
        localStorage.setItem(LOCAL_STORAGE_KEYS.INVENTORY, JSON.stringify(inventory));
     }
  }, [inventory]);

  useEffect(() => {
    if (expenses.length > 0 || localStorage.getItem(LOCAL_STORAGE_KEYS.EXPENSES)) {
        localStorage.setItem(LOCAL_STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
    }
  }, [expenses]);


  const calculateCustomerOutstandingBalance = useCallback((customerId: string, allOrdersList: Order[], excludeOrderId?: string): number => {
    return allOrdersList
      .filter(order => 
        order.customerId === customerId && 
        order.status !== OrderStatus.CANCELLED && 
        (!excludeOrderId || order.id !== excludeOrderId)
      )
      .reduce((sum, order) => sum + order.balanceAmount, 0);
  }, []);

  const calculatePreviousCumulativeEmptyCanBalanceForModal = useCallback((
    customerId: string,
    allOrdersList: Order[],
    products: ProductType[],
    modalOrderDateStr: string, // YYYY-MM-DD from modal
    isEditing: boolean,
    orderBeingEditedOriginalDate?: string, // ISO string of the order being edited, if isEditing
    orderBeingEditedId?: string
  ): number => {
    const twentyLCan = products.find(p => p.name.toLowerCase() === '20l can');
    if (!twentyLCan || !customerId) return 0;

    let cumulativeBalance = 0;
    let relevantOrders: Order[];

    if (isEditing && orderBeingEditedOriginalDate) {
        const editingOrderDateObj = new Date(orderBeingEditedOriginalDate);
        relevantOrders = allOrdersList
            .filter(o =>
                o.customerId === customerId &&
                o.status !== OrderStatus.CANCELLED &&
                o.id !== orderBeingEditedId && 
                new Date(o.orderDate).getTime() < editingOrderDateObj.getTime()
            )
            .sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());
    } else { // For NEW order
        const modalDateOnly = new Date(modalOrderDateStr);
        modalDateOnly.setHours(0,0,0,0); 

        const today = new Date();
        today.setHours(0,0,0,0);

        if (modalDateOnly.getTime() === today.getTime()) {
            // New order for TODAY: calculate balance considering all orders up to NOW.
            relevantOrders = allOrdersList
                .filter(o =>
                    o.customerId === customerId &&
                    o.status !== OrderStatus.CANCELLED &&
                    new Date(o.orderDate) <= new Date() // All orders up to current date and time
                )
                .sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());
        } else {
            // New order for a PAST or FUTURE date: Balance at the START of that selected day.
            relevantOrders = allOrdersList
                .filter(o =>
                    o.customerId === customerId &&
                    o.status !== OrderStatus.CANCELLED &&
                    new Date(new Date(o.orderDate).toDateString()) < modalDateOnly // Compare date part only
                )
                .sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());
        }
    }

    for (const order of relevantOrders) {
        const cansTakenThisOrder = order.items
            .filter(item => item.productId === twentyLCan.id)
            .reduce((sum, item) => sum + item.quantity, 0);
        const cansReturnedThisOrder = order.emptyJarsReturned || 0;
        cumulativeBalance += cansTakenThisOrder;
        cumulativeBalance -= cansReturnedThisOrder;
    }
    return cumulativeBalance;
  }, []);


  const calculateCustomerCumulativeEmptyCanBalance = useCallback((
    customerId: string,
    allOrdersList: Order[],         
    products: ProductType[],
    targetOrder: Order          
  ): number => {
      const twentyLCan = products.find(p => p.name.toLowerCase() === '20l can'); // Changed to can
      if (!twentyLCan || !customerId) return 0;

      let cumulativeBalance = 0;

      const relevantCustomerOrders = allOrdersList
          .filter(o =>
              o.customerId === customerId &&
              o.status !== OrderStatus.CANCELLED 
          )
          .sort((a, b) => { 
              const dateA = new Date(a.orderDate).getTime();
              const dateB = new Date(b.orderDate).getTime();
              if (dateA !== dateB) return dateA - dateB;
              return a.id.localeCompare(b.id); 
          });
          
      for (const order of relevantCustomerOrders) {
          const cansTakenThisOrder = order.items
              .filter(item => item.productId === twentyLCan.id)
              .reduce((sum, item) => sum + item.quantity, 0);
          
          const cansReturnedThisOrder = order.emptyJarsReturned || 0; // Field name from type
          
          cumulativeBalance += cansTakenThisOrder;
          cumulativeBalance -= cansReturnedThisOrder;

          if (order.id === targetOrder.id) {
              break; 
          }
      }
      return cumulativeBalance;
  }, []);


  const handleCustomerFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCustomerFormData(prev => ({ ...prev, [name]: name === 'gstin' ? value.toUpperCase() : value }));
  };

  const handleSaveCustomer = () => {
    if (editingCustomer) {
      setCustomers(customers.map(c => c.id === editingCustomer.id ? { ...editingCustomer, ...customerFormData, id: editingCustomer.id, createdAt: editingCustomer.createdAt } : c));
    } else {
      const newCustomer = { ...customerFormData, id: generateMockId(), createdAt: new Date().toISOString() };
      setCustomers(prevCustomers => [...prevCustomers, newCustomer]);
      if (isAddingCustomerFromOrder) {
        setJustAddedCustomerId(newCustomer.id);
      }
    }
    closeCustomerModal();
  };

  const openCustomerModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setCustomerFormData({ name: customer.name, phone: customer.phone, address: customer.address, type: customer.type, gstin: customer.gstin || '' });
    } else {
      setEditingCustomer(null);
      setCustomerFormData({ name: '', phone: '', address: '', type: CustomerType.HOUSE, gstin: '' });
    }
    setIsCustomerModalOpen(true);
  };

  const closeCustomerModal = () => setIsCustomerModalOpen(false);
  
  useEffect(() => {
    if (!isCustomerModalOpen && isAddingCustomerFromOrder) { 
        if (justAddedCustomerId) { 
            setOrderFormData(prev => ({ ...prev, customerId: justAddedCustomerId }));
            setJustAddedCustomerId(null); 
        }
        setIsAddingCustomerFromOrder(false); 
    }
  }, [isCustomerModalOpen, isAddingCustomerFromOrder, justAddedCustomerId]);


  const handleDeleteCustomer = (customerId: string) => {
    const customerToDelete = customers.find(c => c.id === customerId);
    if (!customerToDelete) return;
    
    openConfirmationModal(
        `Delete Customer: ${customerToDelete.name}`,
        "Are you sure you want to delete this customer? This will also delete all associated orders and revert stock for any delivered orders. This action cannot be undone.",
        () => {
            const customerOrders = orders.filter(o => o.customerId === customerId);
            setInventory(prevInventory => {
                const newInventory = { ...prevInventory };
                customerOrders.forEach(order => {
                    if (order.status === OrderStatus.DELIVERED) {
                        order.items.forEach(item => {
                            newInventory[item.productId] = (newInventory[item.productId] || 0) + item.quantity;
                        });
                    }
                });
                return newInventory;
            });
            setCustomers(customers.filter(c => c.id !== customerId));
            setOrders(orders.filter(o => o.customerId !== customerId));
        }
    );
  };

  const handleOrderMainFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setOrderFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleOrderItemChange = (index: number, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const updatedItems = orderFormData.items.map((item, i) => 
      i === index ? { ...item, [name]: value } : item
    );
    setOrderFormData(prev => ({ ...prev, items: updatedItems }));
  };

  const addOrderItem = () => {
    setOrderFormData(prev => ({
      ...prev,
      items: [...prev.items, { productId: '', quantity: '1' }]
    }));
  };

  const removeOrderItem = (index: number) => {
    if (orderFormData.items.length <= 1) return; 
    setOrderFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleSaveOrder = () => {
    if (!orderFormData.customerId) {
      alert("Please select a customer."); return;
    }
    if (!orderFormData.orderDate) {
      alert("Please select an order date."); return;
    }

    const processedItems: OrderItem[] = [];
    let currentTotalCostPrice = 0;
    for (const formItem of orderFormData.items) {
      const product = productsData.find(p => p.id === formItem.productId);
      if (!product) {
        alert("Please select a valid product for all items."); return;
      }
      const quantityNum = parseInt(formItem.quantity, 10);
      if (isNaN(quantityNum) || quantityNum <= 0) {
        alert("Invalid quantity for one or more items. Must be a positive number."); return;
      }
      processedItems.push({
        productId: product.id,
        quantity: quantityNum,
        unitPrice: product.price,
        itemTotal: product.price * quantityNum,
        unitCostPrice: product.costPrice, 
      });
      currentTotalCostPrice += product.costPrice * quantityNum;
    }

    if (processedItems.length === 0) {
      alert("Please add at least one product to the order."); return;
    }
    
    const transactionAmountPaid = parseFloat(orderFormData.amountPaid) || 0;
    if (isNaN(transactionAmountPaid) || transactionAmountPaid < 0) {
      alert("Invalid amount paid.");
      return;
    }

    const currentOrderItemsTotal = processedItems.reduce((sum, item) => sum + item.itemTotal, 0);
    
    let tempOrders = [...orders]; 
    const customerBalanceFromOtherOrders = calculateCustomerOutstandingBalance(
        orderFormData.customerId, tempOrders, editingOrder ? editingOrder.id : undefined 
    );
    
    const paymentAppliedToOldDebts = Math.min(transactionAmountPaid, customerBalanceFromOtherOrders);
    
    if (paymentAppliedToOldDebts > 0) {
        let remainingPaymentToClearOldDebts = paymentAppliedToOldDebts;
        const customerOldOrders = tempOrders
            .filter(o => 
                o.customerId === orderFormData.customerId &&
                o.id !== (editingOrder ? editingOrder.id : undefined) &&
                o.status !== OrderStatus.CANCELLED &&
                o.balanceAmount > 0
            )
            .sort((a,b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());

        for (const oldOrder of customerOldOrders) {
            if (remainingPaymentToClearOldDebts <= 0) break;
            const paymentForThisOldOrder = Math.min(remainingPaymentToClearOldDebts, oldOrder.balanceAmount);
            const oldOrderIndex = tempOrders.findIndex(o => o.id === oldOrder.id);
            if (oldOrderIndex !== -1) {
                tempOrders[oldOrderIndex] = {
                    ...tempOrders[oldOrderIndex],
                    amountPaid: tempOrders[oldOrderIndex].amountPaid + paymentForThisOldOrder,
                    balanceAmount: tempOrders[oldOrderIndex].balanceAmount - paymentForThisOldOrder,
                };
            }
            remainingPaymentToClearOldDebts -= paymentForThisOldOrder;
        }
    }
    
    const paymentRemainingForCurrentOrder = transactionAmountPaid - paymentAppliedToOldDebts;
    const newBalanceForCurrentOrder = currentOrderItemsTotal - paymentRemainingForCurrentOrder;

    setInventory(prevInventory => {
      let tempInventory = { ...prevInventory };
      const originalDbOrder = editingOrder ? orders.find(o => o.id === editingOrder.id) : null;

      if (originalDbOrder && originalDbOrder.status === OrderStatus.DELIVERED) {
        originalDbOrder.items.forEach(item => {
          tempInventory[item.productId] = (tempInventory[item.productId] || 0) + item.quantity;
        });
      }

      if (orderFormData.status === OrderStatus.DELIVERED) {
         processedItems.forEach(item => {
           tempInventory[item.productId] = (tempInventory[item.productId] || 0) - item.quantity;
         });
      }
      return tempInventory;
    });
    
    let finalOrderDateISO: string;
    if (editingOrder) {
      const formDatePart = orderFormData.orderDate; // YYYY-MM-DD from form
      const originalOrderDate = new Date(editingOrder.orderDate);
      const originalTimePart = originalOrderDate.toISOString().split('T')[1]; // HH:MM:SS.sssZ
      finalOrderDateISO = new Date(`${formDatePart}T${originalTimePart}`).toISOString();
    } else { // New order
      const formDatePart = orderFormData.orderDate; // YYYY-MM-DD from form
      const currentTime = new Date();
      const hours = String(currentTime.getHours()).padStart(2, '0');
      const minutes = String(currentTime.getMinutes()).padStart(2, '0');
      const seconds = String(currentTime.getSeconds()).padStart(2, '0');
      finalOrderDateISO = new Date(`${formDatePart}T${hours}:${minutes}:${seconds}`).toISOString();
    }
    
    const estimatedProfit = currentOrderItemsTotal - currentTotalCostPrice;
    const cansReturnedForThisOrder = parseInt(orderFormData.emptyJarsReturned || '0', 10); // Field name from type

    const newOrderSpecificData: Partial<Order> = { 
      items: processedItems,
      totalAmount: currentOrderItemsTotal,
      amountPaid: transactionAmountPaid,
      balanceAmount: newBalanceForCurrentOrder,
      paymentMode: orderFormData.paymentMode,
      status: orderFormData.status,
      deliveryNotes: orderFormData.deliveryNotes,
      place: orderFormData.place, 
      customerId: orderFormData.customerId,
      orderDate: finalOrderDateISO, 
      totalCostPrice: currentTotalCostPrice, 
      estimatedProfit: estimatedProfit,
      emptyJarsReturned: cansReturnedForThisOrder,
    };

    if (editingOrder) {
      setOrders(tempOrders.map(o => o.id === editingOrder.id ? { ...o, ...newOrderSpecificData } as Order : o));
    } else {
      setOrders([...tempOrders, { 
        ...newOrderSpecificData, 
        id: generateMockId(), 
        orderNumber: `ORD-${String(Date.now()).slice(-4)}-${String(orders.length).padStart(4, '0')}`,
      } as Order]);
    }
    closeOrderModal();
  };
  
  const openOrderModal = (order?: Order) => {
    if (order) {
      setEditingOrder(order);
      setOrderFormData({
        customerId: order.customerId,
        orderDate: new Date(order.orderDate).toISOString().split('T')[0], 
        items: order.items.map(item => ({ productId: item.productId, quantity: String(item.quantity) })),
        amountPaid: String(order.amountPaid), 
        paymentMode: order.paymentMode,
        status: order.status,
        deliveryNotes: order.deliveryNotes || '',
        place: order.place || '', 
        emptyJarsReturned: typeof order.emptyJarsReturned === 'number' ? String(order.emptyJarsReturned) : '', // Field name from type
      });
    } else {
      setEditingOrder(null);
      setOrderFormData(initialOrderFormData);
    }
    setIsOrderModalOpen(true);
  };
  const closeOrderModal = () => setIsOrderModalOpen(false);

  const handleDeleteOrder = (orderId: string) => {
    const orderToDelete = orders.find(o => o.id === orderId);
    if (!orderToDelete) return;

    openConfirmationModal(
        `Delete Order: ${orderToDelete.orderNumber}`,
        "Are you sure you want to delete this order? This will revert stock if the order was delivered. This action cannot be undone.",
        () => {
            if (orderToDelete.status === OrderStatus.DELIVERED) {
                setInventory(prevInventory => {
                    const newInventory = { ...prevInventory };
                    orderToDelete.items.forEach(item => {
                        newInventory[item.productId] = (newInventory[item.productId] || 0) + item.quantity;
                    });
                    return newInventory;
                });
            }
            setOrders(orders.filter(o => o.id !== orderId));
        }
    );
  };

  const updateOrderStatus = (orderId: string, newStatus: OrderStatus) => {
    const orderToUpdate = orders.find(o => o.id === orderId);
    if (!orderToUpdate) return;

    const oldStatus = orderToUpdate.status;
    if (oldStatus === newStatus) return;

    setInventory(prevInventory => {
      const updatedInventory = { ...prevInventory };
      orderToUpdate.items.forEach(item => {
        const productId = item.productId;
        const quantity = item.quantity;
        if (newStatus === OrderStatus.DELIVERED && oldStatus !== OrderStatus.DELIVERED) {
          updatedInventory[productId] = (updatedInventory[productId] || 0) - quantity;
        } 
        else if (newStatus !== OrderStatus.DELIVERED && oldStatus === OrderStatus.DELIVERED) {
          updatedInventory[productId] = (updatedInventory[productId] || 0) + quantity;
        }
      });
      return updatedInventory;
    });

    setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
  };
  
  const handleAddStockToInventory = (productId: string, quantityToAdd: number) => {
    if (quantityToAdd <= 0) {
      alert("Please enter a positive quantity to add."); return;
    }
    setInventory(prevInventory => ({
      ...prevInventory,
      [productId]: (prevInventory[productId] || 0) + quantityToAdd
    }));
  };

  const handleExpenseFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setExpenseFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveExpense = () => {
    const amountNum = parseFloat(expenseFormData.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Please enter a valid positive amount for the expense."); return;
    }
    if (!expenseFormData.description.trim()) {
        alert("Please enter a description for the expense."); return;
    }
    if (!expenseFormData.date) {
        alert("Please select a date for the expense."); return;
    }

    const finalExpenseData = {
      ...expenseFormData,
      amount: amountNum,
      date: new Date(expenseFormData.date).toISOString(), 
    };

    if (editingExpense) {
      setExpenses(expenses.map(exp => exp.id === editingExpense.id ? { ...editingExpense, ...finalExpenseData } : exp));
    } else {
      setExpenses([...expenses, { ...finalExpenseData, id: generateMockId() }]);
    }
    closeExpenseModal();
  };

  const openExpenseModal = (expense?: Expense) => {
    if (expense) {
      setEditingExpense(expense);
      setExpenseFormData({
        date: new Date(expense.date).toISOString().split('T')[0], 
        category: expense.category,
        description: expense.description,
        amount: String(expense.amount),
        vendor: expense.vendor || '',
      });
    } else {
      setEditingExpense(null);
      setExpenseFormData(initialExpenseFormData);
    }
    setIsExpenseModalOpen(true);
  };

  const closeExpenseModal = () => setIsExpenseModalOpen(false);

  const handleDeleteExpense = (expenseId: string) => {
    const expenseToDelete = expenses.find(exp => exp.id === expenseId);
    if (!expenseToDelete) return;

    openConfirmationModal(
        `Delete Expense`,
        `Are you sure you want to delete the expense "${expenseToDelete.description}" for ₹${expenseToDelete.amount}? This action cannot be undone.`,
        () => {
            setExpenses(expenses.filter(exp => exp.id !== expenseId));
        }
    );
  };

  const handleProductFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setProductFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveProduct = () => {
    const priceNum = parseFloat(productFormData.price);
    const costPriceNum = parseFloat(productFormData.costPrice);
    const initialStockNum = parseInt(productFormData.initialStock, 10);

    if (!productFormData.name.trim()) { alert("Product name is required."); return; }
    if (isNaN(priceNum) || priceNum <= 0) { alert("Valid selling price is required."); return; }
    if (isNaN(costPriceNum) || costPriceNum < 0) { alert("Valid cost price is required (can be 0)."); return; } 
    if (isNaN(initialStockNum) || initialStockNum < 0) { alert("Valid initial stock is required."); return; }

    const productPayload: Omit<ProductType, 'id'> = {
        name: productFormData.name.trim(),
        price: priceNum,
        costPrice: costPriceNum,
        initialStock: initialStockNum,
    };

    if (editingProduct) {
        setProductsData(productsData.map(p => p.id === editingProduct.id ? { ...p, ...productPayload} : p));
    } else {
        const newProduct = { ...productPayload, id: generateMockId() };
        setProductsData(prev => [...prev, newProduct]);
        setInventory(prevInv => ({...prevInv, [newProduct.id]: newProduct.initialStock }));
    }
    closeProductModal();
  };

  const openProductModal = (product?: ProductType) => {
    if (product) {
        setEditingProduct(product);
        setProductFormData({
            name: product.name,
            price: String(product.price),
            costPrice: String(product.costPrice),
            initialStock: String(product.initialStock),
        });
    } else {
        setEditingProduct(null);
        setProductFormData(initialProductFormData);
    }
    setIsProductModalOpen(true);
  };
  const closeProductModal = () => setIsProductModalOpen(false);

  const getCustomerName = useCallback((customerId: string) => {
    return customers.find(c => c.id === customerId)?.name || 'Unknown Customer';
  }, [customers]);

  const getProductName = useCallback((productId: string) => {
    return productsData.find(p => p.id === productId)?.name || 'Unknown Product';
  }, [productsData]);

  const getOrderDisplayProducts = useCallback((orderItems: OrderItem[]) => {
    if (!orderItems || orderItems.length === 0) return 'N/A';
    if (orderItems.length === 1) return `${getProductName(orderItems[0].productId)}`;
    const productNames = orderItems.map(item => getProductName(item.productId));
    if (productNames.length > 2) {
        return `${productNames.slice(0, 2).join(', ')}...`;
    }
    return productNames.join(', ');
  }, [getProductName]);

  const getOrderProductsListString = useCallback((orderItems: OrderItem[]): string => {
    if (!orderItems || orderItems.length === 0) return 'N/A';
    return orderItems.map(item => `${getProductName(item.productId)} (Qty: ${item.quantity})`).join('; ');
  }, [getProductName]);
  
  const getOrderDisplayQuantity = useCallback((orderItems: OrderItem[]) => {
    if (!orderItems || orderItems.length === 0) return 0;
    return orderItems.reduce((sum, item) => sum + item.quantity, 0);
  }, []);

  const filteredCustomers = useMemo(() => customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm) ||
    c.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.gstin && c.gstin.toLowerCase().includes(searchTerm.toLowerCase()))
  ).sort((a,b) => a.name.localeCompare(b.name)), [customers, searchTerm]);

  const filteredOrders = useMemo(() => orders.filter(o => {
    const customer = customers.find(c => c.id === o.customerId);
    const productMatch = o.items.some(item => {
        const product = productsData.find(p => p.id === item.productId); 
        return product && product.name.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const searchMatch = (
      o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (customer && customer.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (o.place && o.place.toLowerCase().includes(searchTerm.toLowerCase())) || 
      productMatch
    );
    const statusMatch = orderStatusFilter === 'All' || o.status === orderStatusFilter;
    const dateMatch = orderDateFilter ? isSameDay(o.orderDate, orderDateFilter) : true;
    
    return searchMatch && statusMatch && dateMatch;
  }).sort((a,b) => {
    const dateA = new Date(a.orderDate).getTime();
    const dateB = new Date(b.orderDate).getTime();
    if (dateB !== dateA) {
      return dateB - dateA; 
    }
    return b.id.localeCompare(a.id); 
  }), [orders, customers, productsData, searchTerm, orderStatusFilter, orderDateFilter]);

  const filteredFutureOrders = useMemo(() => orders.filter(o => {
    const customer = customers.find(c => c.id === o.customerId);
    const productMatch = o.items.some(item => {
        const product = productsData.find(p => p.id === item.productId); 
        return product && product.name.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const searchMatch = (
      o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (customer && customer.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (o.place && o.place.toLowerCase().includes(searchTerm.toLowerCase())) || 
      productMatch
    );
    const isFuturePending = isFutureDate(o.orderDate) && o.status === OrderStatus.PENDING;
    const dateMatch = futureOrderDateFilter ? isSameDay(o.orderDate, futureOrderDateFilter) : true;
    
    return isFuturePending && searchMatch && dateMatch;
  }).sort((a,b) => {
    const dateA = new Date(a.orderDate).getTime();
    const dateB = new Date(b.orderDate).getTime();
    if (dateA !== dateB) {
      return dateA - dateB; 
    }
    return a.id.localeCompare(b.id); 
  }), [orders, customers, productsData, searchTerm, futureOrderDateFilter]);

  const deliveryQueueOrders = useMemo(() => {
    return orders
      .filter(o => (o.status === OrderStatus.DISPATCHED || o.status === OrderStatus.PENDING) && isDateTodayOrPast(o.orderDate))
      .sort((a, b) => {
        const dateA = new Date(a.orderDate).getTime();
        const dateB = new Date(b.orderDate).getTime();
        if (dateB !== dateA) { // Sort by date descending (latest first)
          return dateB - dateA;
        }
        return b.id.localeCompare(a.id); // Tie-breaking: newest ID first
      });
  }, [orders]);


  const dashboardStats: StatSummary = useMemo(() => {
    const deliveredOrdersList = orders.filter(o => o.status === OrderStatus.DELIVERED);
    
    const todaysOrdersList = orders.filter(o => isDateToday(o.orderDate) && o.status !== OrderStatus.CANCELLED);
    const todaysSalesAmount = todaysOrdersList.reduce((sum, o) => sum + o.totalAmount, 0);
    const todaysIncomeAmount = todaysOrdersList.reduce((sum, o) => sum + o.amountPaid, 0);

    const activePendingOrders = orders.filter(o => 
      (o.status === OrderStatus.PENDING || o.status === OrderStatus.DISPATCHED) &&
      isDateTodayOrPast(o.orderDate)
    ).length;

    const scheduledFutureOrders = orders.filter(o => 
      o.status === OrderStatus.PENDING && isFutureDate(o.orderDate)
    ).length;

    const todaysExpensesList = expenses.filter(e => isDateToday(e.date));
    const todaysExpensesAmount = todaysExpensesList.reduce((sum, e) => sum + e.amount, 0);

    const thisMonthExpensesList = expenses.filter(e => isDateThisMonth(e.date));
    const thisMonthExpensesAmount = thisMonthExpensesList.reduce((sum, e) => sum + e.amount, 0);
    
    // Reworked "This Month" calculations for consistency with "Today"
    const thisMonthOrdersList = orders.filter(o => isDateThisMonth(o.orderDate) && o.status !== OrderStatus.CANCELLED);
    const thisMonthSalesAmount = thisMonthOrdersList.reduce((sum, o) => sum + o.totalAmount, 0);
    const thisMonthIncomeAmount = thisMonthOrdersList.reduce((sum, o) => sum + o.amountPaid, 0);

    const thisMonthDeliveredOrders = deliveredOrdersList.filter(o => isDateThisMonth(o.orderDate));
    const thisMonthProfitAmount = thisMonthDeliveredOrders.reduce((sum, o) => sum + o.estimatedProfit, 0);
    const totalProfitAmount = deliveredOrdersList.reduce((sum, o) => sum + o.estimatedProfit, 0);

    return {
      deliveredOrders: deliveredOrdersList.length,
      pendingOrders: activePendingOrders,
      totalCustomers: customers.length,
      todaysSales: todaysSalesAmount,
      todaysIncome: todaysIncomeAmount,
      todaysOrdersCount: todaysOrdersList.length,
      scheduledOrdersCount: scheduledFutureOrders,
      todaysExpenses: todaysExpensesAmount,
      thisMonthExpenses: thisMonthExpensesAmount,
      thisMonthSales: thisMonthSalesAmount,
      thisMonthIncome: thisMonthIncomeAmount,
      totalEstimatedProfit: totalProfitAmount,
      thisMonthEstimatedProfit: thisMonthProfitAmount,
    };
  }, [orders, customers, expenses]);

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.PENDING: return 'bg-yellow-400';
      case OrderStatus.DISPATCHED: return 'bg-blue-400';
      case OrderStatus.DELIVERED: return 'bg-green-500';
      case OrderStatus.CANCELLED: return 'bg-red-500';
      default: return 'bg-slate-400';
    }
  };
  
  const commonInputClass = "mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brandSky focus:ring-1 focus:ring-brandSky";
  const commonLabelClass = "block text-sm font-medium text-slate-700";
  const commonButtonClass = "w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2";

  const currentOrderItemsTotalForModal = useMemo(() => {
    return orderFormData.items.reduce((sum, item) => {
      const product = productsData.find(p => p.id === item.productId); 
      const quantity = parseInt(item.quantity) || 0;
      return sum + (product ? product.price * quantity : 0);
    }, 0);
  }, [orderFormData.items, productsData]);
  
  const previousCustomerBalanceForModal = useMemo(() => {
    if (!orderFormData.customerId || !isOrderModalOpen) return 0; 
    return calculateCustomerOutstandingBalance(
        orderFormData.customerId, 
        orders, 
        editingOrder ? editingOrder.id : undefined
    );
  }, [orderFormData.customerId, orders, editingOrder, calculateCustomerOutstandingBalance, isOrderModalOpen]);

  const totalAmountDueNowForModal = useMemo(() => currentOrderItemsTotalForModal + previousCustomerBalanceForModal, [currentOrderItemsTotalForModal, previousCustomerBalanceForModal]);
  const amountPaidNowForModal = useMemo(() => parseFloat(orderFormData.amountPaid) || 0, [orderFormData.amountPaid]);
  const newOverallCustomerBalanceForModal = useMemo(() => totalAmountDueNowForModal - amountPaidNowForModal, [totalAmountDueNowForModal, amountPaidNowForModal]);

  const has20LCanInOrderModal = useMemo(() => { // Renamed from Jar
    if (!productsData || productsData.length === 0) return false;
    const twentyLitreCanProduct = productsData.find(p => p.name.toLowerCase() === '20l can'); // Changed to can
    if (!twentyLitreCanProduct) return false;
    return orderFormData.items.some(item => item.productId === twentyLitreCanProduct.id && parseInt(item.quantity) > 0);
  }, [orderFormData.items, productsData]);

  const previousEmptyCanBalanceForModal = useMemo(() => {
    if (!orderFormData.customerId || !isOrderModalOpen || !productsData.length) return 0;
    return calculatePreviousCumulativeEmptyCanBalanceForModal(
        orderFormData.customerId,
        orders,
        productsData,
        orderFormData.orderDate, // This is the date string from the modal's input
        !!editingOrder, // isEditing
        editingOrder?.orderDate, // orderBeingEditedOriginalDate (original ISO string)
        editingOrder?.id // orderBeingEditedId
    );
  }, [orderFormData.customerId, orderFormData.orderDate, orders, productsData, editingOrder, isOrderModalOpen, calculatePreviousCumulativeEmptyCanBalanceForModal]);


  const currentOrder20LCansQuantity = useMemo(() => { // Renamed from Jars
    if (!has20LCanInOrderModal || !productsData.length) return 0;
    const twentyLCan = productsData.find(p => p.name.toLowerCase() === '20l can'); // Changed to can
    if (!twentyLCan) return 0;
    return orderFormData.items
        .filter(item => item.productId === twentyLCan.id)
        .reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);
  }, [orderFormData.items, productsData, has20LCanInOrderModal]);

  const cansReturnedInModal = parseInt(orderFormData.emptyJarsReturned || '0', 10); // Field name from type
  const netEmptyCanBalanceForModalDisplay = previousEmptyCanBalanceForModal + currentOrder20LCansQuantity - cansReturnedInModal; // Renamed


  // UPI QR Code Generation Effect
  useEffect(() => {
    if (isOrderModalOpen && orderFormData.paymentMode === PaymentMode.UPI) {
      const amountForQR = Math.max(0, totalAmountDueNowForModal);
      const upiString = `upi://pay?pa=${DUMMY_UPI_ID}&pn=${encodeURIComponent(COMPANY_NAME)}&am=${amountForQR.toFixed(2)}&cu=INR&tn=OrderPaymentJM`;

      QRCode.toDataURL(upiString, { errorCorrectionLevel: 'M', margin: 2, width: 220 }) 
        .then(url => {
          setUpiQrCodeUrl(url);
        })
        .catch(err => {
          console.error('QR Code Generation Error:', err);
          setUpiQrCodeUrl(null);
        });
    } else {
      setUpiQrCodeUrl(null); 
    }
  }, [isOrderModalOpen, orderFormData.paymentMode, totalAmountDueNowForModal]);


  const escapeCsvCell = useCallback((cellData: any): string => {
    if (cellData === null || cellData === undefined) {
      return '';
    }
    let cellString = String(cellData);
    if (cellString.search(/("|,|\n)/g) >= 0) {
      cellString = '"' + cellString.replace(/"/g, '""') + '"';
    }
    return cellString;
  }, []);

  const handleExportOrdersToCSV = useCallback((ordersToExport: Order[]) => {
    if (ordersToExport.length === 0) {
      alert("No orders to export.");
      return;
    }

    const headers = [
      "Order Number", "Customer Name", "Order Date", "Place", "Products", 
      "Total Quantity", 
      "20L Cans Returned (This Order)", "Cumulative 20L Cans Balance", // Changed Jar to Can
      "Order Total (INR)", "Amount Paid (INR)", 
      "Balance Amount (INR)", "Estimated Profit (INR)", "Status", 
      "Payment Mode", "Delivery Notes"
    ];

    const rows = ordersToExport.map(order => {
      const cumulativeCanBalance = calculateCustomerCumulativeEmptyCanBalance(order.customerId, orders, productsData, order); // Changed to Can
      return [
        order.orderNumber,
        getCustomerName(order.customerId),
        new Date(order.orderDate).toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
        order.place || '', 
        getOrderProductsListString(order.items), 
        getOrderDisplayQuantity(order.items),
        typeof order.emptyJarsReturned === 'number' ? order.emptyJarsReturned : '', // Field name from type
        cumulativeCanBalance, // Changed
        order.totalAmount.toFixed(2),
        order.amountPaid.toFixed(2),
        order.balanceAmount.toFixed(2),
        order.estimatedProfit.toFixed(2),
        order.status,
        order.paymentMode,
        order.deliveryNotes || ''
      ].map(cell => escapeCsvCell(cell));
    });


    const csvHeaderString = headers.join(',');
    const csvRowsStrings = rows.map(row => row.join(','));
    
    const BOM = '\uFEFF'; 
    const csvString = BOM + [csvHeaderString, ...csvRowsStrings].join('\n');
    
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const timestamp = new Date().toISOString().slice(0,10);
    link.setAttribute("download", `orders_export_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [getCustomerName, getOrderProductsListString, getOrderDisplayQuantity, escapeCsvCell, productsData, orders, calculateCustomerCumulativeEmptyCanBalance]);

  const handleExportAllData = () => {
    const allData: AllCrmData = {
      customers,
      orders,
      productsData,
      inventory,
      expenses,
    };
    const jsonString = JSON.stringify(allData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0,10).replace(/-/g,'');
    link.href = url;
    link.download = `jmaqua_crm_backup_${timestamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    alert('All CRM data has been exported successfully!');
  };

  const handleImportFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result;
          if (typeof text === 'string') {
            const parsedData = JSON.parse(text) as AllCrmData;
            // Basic validation
            if (
              Array.isArray(parsedData.customers) &&
              Array.isArray(parsedData.orders) &&
              Array.isArray(parsedData.productsData) &&
              typeof parsedData.inventory === 'object' &&
              parsedData.inventory !== null &&
              Array.isArray(parsedData.expenses)
            ) {
              setDataToImport(parsedData);
              setImportMode('merge'); // Default to merge
              setIsImportConfirmationModalOpen(true);
            } else {
              alert('Invalid file format. The JSON structure is not correct for CRM data.');
              setDataToImport(null);
            }
          }
        } catch (error) {
          console.error('Error parsing imported JSON:', error);
          alert('Failed to parse JSON file. Please ensure it is a valid backup file.');
          setDataToImport(null);
        }
      };
      reader.readAsText(file);
    }
    // Reset file input to allow selecting the same file again
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  const confirmImportData = () => {
    if (!dataToImport) return;

    if (importMode === 'replace') {
      // The original destructive overwrite logic
      Object.values(LOCAL_STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
      localStorage.setItem(LOCAL_STORAGE_KEYS.CUSTOMERS, JSON.stringify(dataToImport.customers));
      localStorage.setItem(LOCAL_STORAGE_KEYS.ORDERS, JSON.stringify(dataToImport.orders));
      localStorage.setItem(LOCAL_STORAGE_KEYS.PRODUCTS_DATA, JSON.stringify(dataToImport.productsData));
      localStorage.setItem(LOCAL_STORAGE_KEYS.INVENTORY, JSON.stringify(dataToImport.inventory));
      localStorage.setItem(LOCAL_STORAGE_KEYS.EXPENSES, JSON.stringify(dataToImport.expenses));
      loadAllData(dataToImport);
      alert('Data imported successfully by replacing all existing data! The application will now reload.');
      setDataToImport(null);
      setIsImportConfirmationModalOpen(false);
      window.location.reload(); 
    } else {
      // New "Merge" logic
      // De-duplicate helper function
      const mergeArraysById = <T extends {id: string}>(current: T[], imported: T[]): T[] => {
          const combined = [...imported, ...current]; // Current items will overwrite imported ones on conflict
          const map = new Map(combined.map(item => [item.id, item]));
          return Array.from(map.values());
      };

      const mergedCustomers = mergeArraysById(customers, dataToImport.customers || []);
      const mergedOrders = mergeArraysById(orders, dataToImport.orders || []);
      const mergedProducts = mergeArraysById(productsData, dataToImport.productsData || []);
      const mergedExpenses = mergeArraysById(expenses, dataToImport.expenses || []);
      
      // Recalculate inventory from scratch based on merged data for accuracy
      const baseInv = mergedProducts.reduce((acc, product) => {
        acc[product.id] = product.initialStock;
        return acc;
      }, {} as InventoryData);

      const finalInventory = { ...baseInv };
      mergedOrders.forEach(order => {
        if (order.status === OrderStatus.DELIVERED) {
          order.items.forEach(item => {
            finalInventory[item.productId] = (finalInventory[item.productId] || 0) - item.quantity;
          });
        }
      });
      
      setCustomers(mergedCustomers);
      setOrders(mergedOrders);
      setProductsData(mergedProducts);
      setExpenses(mergedExpenses);
      setInventory(finalInventory);
      
      alert('Data merged successfully!');
      setDataToImport(null);
      setIsImportConfirmationModalOpen(false);
    }
  };

  const cancelImportData = () => {
    setDataToImport(null);
    setIsImportConfirmationModalOpen(false);
  };

  const handleExportExpensesToCSV = useCallback((expensesToExport: Expense[]) => {
    if (expensesToExport.length === 0) {
      alert("No expenses to export.");
      return;
    }
  
    const headers = [
      "Date", "Category", "Description", "Vendor", "Amount (INR)"
    ];
  
    const rows = expensesToExport.map(expense => [
      new Date(expense.date).toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }),
      expense.category,
      expense.description,
      expense.vendor || '',
      expense.amount.toFixed(2)
    ].map(cell => escapeCsvCell(cell)));
  
    const csvHeaderString = headers.join(',');
    const csvRowsStrings = rows.map(row => row.join(','));
    const BOM = '\uFEFF';
    const csvString = BOM + [csvHeaderString, ...csvRowsStrings].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const timestamp = new Date().toISOString().slice(0, 10);
    link.setAttribute("download", `expenses_export_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [escapeCsvCell]);

  const handleArchiveOrders = (cutoff: '6m' | '1y' | '2y') => {
    const cutoffDate = new Date();
    if (cutoff === '6m') cutoffDate.setMonth(cutoffDate.getMonth() - 6);
    else if (cutoff === '1y') cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
    else if (cutoff === '2y') cutoffDate.setFullYear(cutoffDate.getFullYear() - 2);

    let ordersToKeep: Order[] = [];
    let ordersToDeleteCount = 0;
    
    for (const order of orders) {
      const orderDate = new Date(order.orderDate);
      const isFulfilled = order.status === OrderStatus.DELIVERED || order.status === OrderStatus.CANCELLED;
      
      if (isFulfilled && orderDate < cutoffDate) {
        ordersToDeleteCount++;
      } else {
        ordersToKeep.push(order);
      }
    }

    if (ordersToDeleteCount === 0) {
      alert("No old, fulfilled orders found to archive for the selected period.");
      return;
    }

    openConfirmationModal(
      'Confirm Archive',
      `You are about to permanently delete ${ordersToDeleteCount} old, fulfilled (Delivered or Cancelled) orders from before ${cutoffDate.toLocaleDateString()}.

This action will free up storage space but cannot be undone. Financial totals and inventory levels will NOT be affected.

Are you sure you want to proceed?`,
      () => {
        setOrders(ordersToKeep);
        alert(`${ordersToDeleteCount} old orders have been successfully archived.`);
      }
    );
  };

  return (
    <HashRouter>
      <div className="flex h-screen bg-slate-100">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <Header />
          <Routes>
            <Route path="/" element={<DashboardPage 
                                      stats={dashboardStats} 
                                      recentOrders={filteredOrders.slice(0,5)} 
                                      getCustomerName={getCustomerName} 
                                      getOrderDisplayProducts={getOrderDisplayProducts} 
                                      getOrderDisplayQuantity={getOrderDisplayQuantity} 
                                      getStatusColor={getStatusColor}
                                      inventory={inventory}
                                      productsData={productsData} 
                                      />} />
            <Route path="/customers" element={
              <PageWrapper 
                title="Customers" 
                showAddButton 
                onAdd={() => openCustomerModal()} 
                addButtonLabel="Add Customer"
                searchTerm={searchTerm}
                onSearchTermChange={setSearchTerm}
              >
                <CustomerTable 
                    customers={filteredCustomers} 
                    allOrders={orders} 
                    onEdit={openCustomerModal} 
                    onDelete={handleDeleteCustomer} 
                    calculateCustomerOutstandingBalance={calculateCustomerOutstandingBalance}
                />
              </PageWrapper>
            }/>
            <Route path="/customers/:customerId" element={
              <CustomerLedgerPage 
                customers={customers}
                allOrders={orders}
                productsData={productsData}
                onEditOrder={openOrderModal}
                getOrderDisplayProducts={getOrderDisplayProducts}
                getStatusColor={getStatusColor}
                calculateCustomerOutstandingBalance={calculateCustomerOutstandingBalance}
                calculateCustomerCumulativeEmptyCanBalance={calculateCustomerCumulativeEmptyCanBalance} // Changed to Can
              />
            }/>
            <Route path="/orders" element={
              <PageWrapper 
                title="Orders" 
                showAddButton 
                onAdd={() => openOrderModal()} 
                addButtonLabel="Create Order" 
                searchTerm={searchTerm}
                onSearchTermChange={setSearchTerm}
                showOrderStatusFilter 
                orderStatusFilter={orderStatusFilter}
                onOrderStatusFilterChange={setOrderStatusFilter}
                showDateFilter 
                dateFilterValue={orderDateFilter}
                onDateFilterChange={setOrderDateFilter}
                onClearDateFilter={() => setOrderDateFilter('')}
                showExportButton 
                onExport={() => handleExportOrdersToCSV(filteredOrders.filter(o => isDateTodayOrPast(o.orderDate) || o.status === OrderStatus.DELIVERED || o.status === OrderStatus.CANCELLED))} 
                exportButtonLabel="Export CSV" 
                exportDisabled={filteredOrders.filter(o => isDateTodayOrPast(o.orderDate) || o.status === OrderStatus.DELIVERED || o.status === OrderStatus.CANCELLED).length === 0}
              >
                <OrderTable 
                  orders={filteredOrders.filter(o => isDateTodayOrPast(o.orderDate) || o.status === OrderStatus.DELIVERED || o.status === OrderStatus.CANCELLED)} 
                  allOrders={orders} 
                  customers={customers} 
                  productsData={productsData} 
                  onEdit={openOrderModal} 
                  onDelete={handleDeleteOrder} 
                  getCustomerName={getCustomerName} 
                  getOrderDisplayProducts={getOrderDisplayProducts} 
                  getOrderProductsListString={getOrderProductsListString}
                  getOrderDisplayQuantity={getOrderDisplayQuantity} 
                  getStatusColor={getStatusColor} 
                  calculateCustomerOutstandingBalance={calculateCustomerOutstandingBalance} 
                  calculateCustomerCumulativeEmptyCanBalance={calculateCustomerCumulativeEmptyCanBalance} // Changed to Can
                  />
              </PageWrapper>
            }/>
            <Route path="/future-orders" element={
               <PageWrapper 
                title="Future Orders" 
                showAddButton 
                onAdd={() => openOrderModal()} 
                addButtonLabel="Schedule Order" 
                searchTerm={searchTerm}
                onSearchTermChange={setSearchTerm}
                showOrderStatusFilter={false} 
                showDateFilter 
                dateFilterValue={futureOrderDateFilter}
                onDateFilterChange={setFutureOrderDateFilter}
                onClearDateFilter={() => setFutureOrderDateFilter('')}
                showExportButton
                onExport={() => handleExportOrdersToCSV(filteredFutureOrders)}
                exportButtonLabel="Export CSV"
                exportDisabled={filteredFutureOrders.length === 0}
              >
                <OrderTable 
                  orders={filteredFutureOrders} 
                  allOrders={orders} 
                  customers={customers} 
                  productsData={productsData} 
                  onEdit={openOrderModal} 
                  onDelete={handleDeleteOrder} 
                  getCustomerName={getCustomerName} 
                  getOrderDisplayProducts={getOrderDisplayProducts} 
                  getOrderProductsListString={getOrderProductsListString}
                  getOrderDisplayQuantity={getOrderDisplayQuantity} 
                  getStatusColor={getStatusColor} 
                  calculateCustomerOutstandingBalance={calculateCustomerOutstandingBalance} 
                  calculateCustomerCumulativeEmptyCanBalance={calculateCustomerCumulativeEmptyCanBalance} // Changed to Can
                  />
              </PageWrapper>
            }/>
             <Route path="/expenses" element={
              <ExpensesPage
                expenses={expenses}
                onAddExpense={() => openExpenseModal()}
                onEditExpense={openExpenseModal}
                onDeleteExpense={handleDeleteExpense}
                globalSearchTerm={searchTerm} 
                setGlobalSearchTerm={setSearchTerm}
                onExportExpenses={handleExportExpensesToCSV} 
              />
            }/>
            <Route path="/delivery" element={
              <PageWrapper title="Delivery Queue" showSearch={false} >
                <DeliveryView 
                  orders={deliveryQueueOrders} 
                  allOrders={orders}
                  updateOrderStatus={updateOrderStatus} 
                  getCustomerName={getCustomerName} 
                  getProductName={getProductName}
                  getStatusColor={getStatusColor}
                  customers={customers}
                  productsData={productsData}
                  calculateCustomerCumulativeEmptyCanBalance={calculateCustomerCumulativeEmptyCanBalance} // Changed to Can
                />
              </PageWrapper>
            }/>
             <Route path="/admin" element={
              <PageWrapper title="Admin Panel" showSearch={false}>
                <AdminPanel 
                  productsData={productsData} 
                  inventory={inventory}
                  onAddStock={handleAddStockToInventory}
                  onOpenProductModal={openProductModal} 
                  onExportAllData={handleExportAllData}
                  onImportAllData={() => fileInputRef.current?.click()}
                  onArchiveOrders={handleArchiveOrders}
                />
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImportFileSelect} 
                    accept=".json" 
                    style={{ display: 'none' }} 
                    aria-hidden="true"
                />
              </PageWrapper>
            }/>
            <Route path="/invoice" element={<InvoicePage productsData={productsData} />} /> 
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>

      {/* Modals */}
      <Modal isOpen={isOrderModalOpen} onClose={closeOrderModal} title={editingOrder ? "Edit Order" : "Create New Order"} size="xl">
        <form onSubmit={(e) => { e.preventDefault(); handleSaveOrder(); }} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="customerId" className={commonLabelClass}>Customer</label>
              <div className="flex items-end gap-2">
                  <select name="customerId" id="customerId" value={orderFormData.customerId} onChange={handleOrderMainFormChange} className={`${commonInputClass} flex-grow`} required aria-required="true">
                    <option value="">Select Customer</option>
                    {customers.sort((a,b) => a.name.localeCompare(b.name)).map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone}) {c.gstin ? ` (GST: ${c.gstin})`: ''}</option>)}
                  </select>
                  <button 
                    type="button" 
                    onClick={() => {
                        setIsAddingCustomerFromOrder(true);
                        openCustomerModal(); 
                    }}
                    className="text-sm text-brandBlue hover:text-brandBlue-dark font-medium py-2 px-3 border border-brandBlue rounded-md hover:bg-brandBlue/10 transition-colors whitespace-nowrap self-end mb-0"
                    title="Add a new customer"
                    style={{ height: 'calc(1.5em + .75rem + 2px + 2px)' }} 
                    >
                    {ICONS.add('w-4 h-4 inline-block mr-1')} New
                  </button>
              </div>
            </div>
             <div>
                <label htmlFor="orderDate" className={commonLabelClass}>Order Date</label>
                <input 
                    type="date" 
                    name="orderDate" 
                    id="orderDate" 
                    value={orderFormData.orderDate} 
                    onChange={handleOrderMainFormChange} 
                    className={commonInputClass} 
                    required 
                    aria-required="true"
                />
            </div>
          </div>
          
          {orderFormData.customerId && (
            <div className="p-2 bg-amber-50 border border-amber-200 rounded-md text-sm text-slate-700" aria-live="polite">
              Previous Customer Balance: <span className="font-semibold">₹{previousCustomerBalanceForModal.toLocaleString()}</span>
            </div>
          )}

          <div className="space-y-3 py-2 border-y border-slate-200">
            <h3 className="text-md font-semibold text-slate-700">Order Items</h3>
            {orderFormData.items.map((item, index) => (
              <div key={index} className="flex flex-col md:flex-row items-start md:items-end gap-2 p-2 border border-slate-200 rounded-md">
                <div className="flex-grow w-full md:w-auto">
                  <label htmlFor={`item_productId_${index}`} className={commonLabelClass}>Product</label>
                  <select 
                    name="productId" 
                    id={`item_productId_${index}`} 
                    value={item.productId} 
                    onChange={(e) => handleOrderItemChange(index, e)} 
                    className={commonInputClass} 
                    required 
                    aria-required="true"
                  >
                    <option value="">Select Product</option>
                    {productsData.map(p => <option key={p.id} value={p.id}>{p.name} (₹{p.price})</option>)}
                  </select>
                </div>
                <div className="w-full md:w-1/4">
                  <label htmlFor={`item_quantity_${index}`} className={commonLabelClass}>Quantity</label>
                  <input 
                    type="number" 
                    name="quantity" 
                    id={`item_quantity_${index}`} 
                    value={item.quantity} 
                    onChange={(e) => handleOrderItemChange(index, e)} 
                    className={commonInputClass} 
                    min="1" 
                    required 
                    aria-required="true" 
                  />
                </div>
                {orderFormData.items.length > 1 && (
                  <button 
                    type="button" 
                    onClick={() => removeOrderItem(index)} 
                    className="text-red-500 hover:text-red-700 p-2 mt-2 md:mt-0 md:self-end"
                    title="Remove item"
                    aria-label={`Remove item ${index + 1}`}
                  >
                    {ICONS.delete('w-5 h-5')}
                  </button>
                )}
              </div>
            ))}
            <button 
              type="button" 
              onClick={addOrderItem} 
              className="mt-2 text-sm text-brandBlue hover:text-brandBlue-dark font-medium flex items-center gap-1"
            >
              {ICONS.add('w-4 h-4')} Add Another Product
            </button>
          </div>
          
          {(has20LCanInOrderModal || orderFormData.emptyJarsReturned) && ( // Changed to Can
            <div className="mt-3 p-3 bg-sky-50 border border-sky-200 rounded-md">
              <h4 className="text-md font-semibold text-slate-700 mb-2">20L Can Tracking</h4> 
              {orderFormData.customerId && (
                <p className="text-sm text-slate-600 mb-1">
                  Previous Empty Can Balance: <span className="font-semibold">{previousEmptyCanBalanceForModal}</span> 
                </p>
              )}
              {has20LCanInOrderModal && ( // Changed
                <p className="text-sm text-slate-600 mb-1">
                  20L Cans in This Order: <span className="font-semibold">{currentOrder20LCansQuantity}</span> 
                </p>
              )}
              <div>
                <label htmlFor="emptyJarsReturned" className={commonLabelClass}>Empty 20L Cans Returned (This Order)</label> 
                <input
                  type="number"
                  name="emptyJarsReturned" // Field name from type
                  id="emptyJarsReturned"
                  value={orderFormData.emptyJarsReturned || ''}
                  onChange={handleOrderMainFormChange}
                  className={commonInputClass}
                  min="0"
                  placeholder="Number of empty 20L cans customer returned" 
                />
              </div>
              {orderFormData.customerId && (
                <p className="text-sm text-slate-600 mt-2">
                  Net Empty Can Balance (After this order): <span className={`font-semibold ${netEmptyCanBalanceForModalDisplay > 0 ? 'text-red-600' : (netEmptyCanBalanceForModalDisplay === 0 ? 'text-green-600' : 'text-blue-600')}`}>{netEmptyCanBalanceForModalDisplay}</span> {/* Changed */}
                </p>
              )}
            </div>
          )}

          <div className="p-2 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-700" aria-live="polite">
            Current Order Items Total (Excl. Tax): <span className="font-semibold">₹{currentOrderItemsTotalForModal.toLocaleString()}</span>
          </div>
           <div className="p-2 bg-blue-50 border border-blue-200 rounded-md text-sm text-slate-700" aria-live="polite">
            Total Amount Due Now (Order Excl. Tax + prev. balance): <span className="font-semibold">₹{totalAmountDueNowForModal.toLocaleString()}</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="paymentMode" className={commonLabelClass}>Payment Mode</label>
              <select name="paymentMode" id="paymentMode" value={orderFormData.paymentMode} onChange={handleOrderMainFormChange} className={commonInputClass} required aria-required="true">
                {Object.values(PaymentMode).map(mode => <option key={mode} value={mode}>{mode}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="amountPaid" className={commonLabelClass}>Amount Paid Now</label>
              <input type="number" name="amountPaid" id="amountPaid" value={orderFormData.amountPaid} onChange={handleOrderMainFormChange} className={commonInputClass} min="0" required aria-required="true" placeholder="Total amount paid in this transaction" />
            </div>
          </div>
          
          {orderFormData.paymentMode === PaymentMode.UPI && upiQrCodeUrl && (
            <div className="my-3 p-3 border border-dashed border-brandBlue rounded-md text-center bg-blue-50">
              <h4 className="text-md font-semibold text-slate-700 mb-2">Scan to Pay (UPI)</h4>
              <img src={upiQrCodeUrl} alt="UPI QR Code" className="mx-auto border shadow-md w-48 h-48" />
              <p className="text-xs text-slate-600 mt-2">
                Dummy QR Code. UPI ID: <strong className="font-mono">{DUMMY_UPI_ID}</strong>
              </p>
              <p className="text-xs text-red-500 mt-1">
                Note: This is a placeholder. Replace with your actual UPI ID in App.tsx (DUMMY_UPI_ID).
              </p>
              <p className="text-sm font-semibold text-slate-700 mt-1">
                 Amount to Pay: ₹{Math.max(0, totalAmountDueNowForModal).toFixed(2)}
              </p>
            </div>
          )}

          <div className={`p-2 rounded-md text-sm text-slate-700 ${newOverallCustomerBalanceForModal > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`} aria-live="polite">
            New Overall Customer Balance: <span className="font-semibold">₹{newOverallCustomerBalanceForModal.toLocaleString()}</span>
            {newOverallCustomerBalanceForModal <= 0 && amountPaidNowForModal > 0 && totalAmountDueNowForModal > 0 && <span className="text-green-700"> (Cleared)</span>}
          </div>
          
          <div>
            <label htmlFor="status" className={commonLabelClass}>Order Status</label>
            <select name="status" id="status" value={orderFormData.status} onChange={handleOrderMainFormChange} className={commonInputClass} required aria-required="true">
              {Object.values(OrderStatus).map(status => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="place" className={commonLabelClass}>Place (Optional)</label>
            <input 
                type="text" 
                name="place" 
                id="place" 
                value={orderFormData.place || ''} 
                onChange={handleOrderMainFormChange} 
                className={commonInputClass} 
                placeholder="e.g., Event Hall B, Specific Site Name"
            />
          </div>

          <div>
            <label htmlFor="deliveryNotes" className={commonLabelClass}>Delivery Notes (Optional)</label>
            <textarea name="deliveryNotes" id="deliveryNotes" value={orderFormData.deliveryNotes || ''} onChange={handleOrderMainFormChange} rows={2} className={commonInputClass} />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={closeOrderModal} className={`${commonButtonClass} bg-slate-200 hover:bg-slate-300 text-slate-700 focus:ring-slate-400`}>Cancel</button>
            <button type="submit" className={`${commonButtonClass} bg-brandBlue hover:bg-brandBlue-dark focus:ring-brandBlue`}>Save Order</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isCustomerModalOpen} onClose={closeCustomerModal} title={editingCustomer ? "Edit Customer" : "Add New Customer"} size="md">
        <form onSubmit={(e) => { e.preventDefault(); handleSaveCustomer(); }} className="space-y-4">
          <div>
            <label htmlFor="name" className={commonLabelClass}>Full Name</label>
            <input type="text" name="name" id="name" value={customerFormData.name} onChange={handleCustomerFormChange} className={commonInputClass} required aria-required="true" />
          </div>
          <div>
            <label htmlFor="phone" className={commonLabelClass}>Phone Number</label>
            <input type="tel" name="phone" id="phone" value={customerFormData.phone} onChange={handleCustomerFormChange} className={commonInputClass} required aria-required="true" />
          </div>
          <div>
            <label htmlFor="address" className={commonLabelClass}>Address</label>
            <textarea name="address" id="address" value={customerFormData.address} onChange={handleCustomerFormChange} rows={3} className={commonInputClass} required aria-required="true" />
          </div>
          <div>
            <label htmlFor="gstin" className={commonLabelClass}>GSTIN (Optional)</label>
            <input 
              type="text" name="gstin" id="gstin" value={customerFormData.gstin} onChange={handleCustomerFormChange} 
              className={commonInputClass} maxLength={15}
              pattern="^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
              title="Enter a valid GSTIN (e.g., 22AAAAA0000A1Z5)" placeholder="e.g., 33ABCDE1234F1Z5"
            />
          </div>
          <div>
            <label htmlFor="type" className={commonLabelClass}>Customer Type</label>
            <select name="type" id="type" value={customerFormData.type} onChange={handleCustomerFormChange} className={commonInputClass} required aria-required="true">
              {Object.values(CustomerType).map(type => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={closeCustomerModal} className={`${commonButtonClass} bg-slate-200 hover:bg-slate-300 text-slate-700 focus:ring-slate-400`}>Cancel</button>
            <button type="submit" className={`${commonButtonClass} bg-brandBlue hover:bg-brandBlue-dark focus:ring-brandBlue`}>Save Customer</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isExpenseModalOpen} onClose={closeExpenseModal} title={editingExpense ? "Edit Expense" : "Add New Expense"} size="md">
        <form onSubmit={(e) => { e.preventDefault(); handleSaveExpense(); }} className="space-y-4">
          <div>
            <label htmlFor="expenseDate" className={commonLabelClass}>Date</label>
            <input type="date" name="date" id="expenseDate" value={expenseFormData.date} onChange={handleExpenseFormChange} className={commonInputClass} required aria-required="true" />
          </div>
          <div>
            <label htmlFor="category" className={commonLabelClass}>Category</label>
            <select name="category" id="category" value={expenseFormData.category} onChange={handleExpenseFormChange} className={commonInputClass} required aria-required="true">
              {EXPENSE_CATEGORY_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="description" className={commonLabelClass}>Description</label>
            <input type="text" name="description" id="description" value={expenseFormData.description} onChange={handleExpenseFormChange} className={commonInputClass} required aria-required="true" placeholder="e.g., PET Bottles, Tea & Snacks" />
          </div>
          <div>
            <label htmlFor="amount" className={commonLabelClass}>Amount (₹)</label>
            <input type="number" name="amount" id="amount" value={expenseFormData.amount} onChange={handleExpenseFormChange} className={commonInputClass} required aria-required="true" placeholder="e.g., 1500" min="0.01" step="0.01" />
          </div>
          <div>
            <label htmlFor="vendor" className={commonLabelClass}>Vendor (Optional)</label>
            <input type="text" name="vendor" id="vendor" value={expenseFormData.vendor || ''} onChange={handleExpenseFormChange} className={commonInputClass} placeholder="e.g., Local Supplier Inc." />
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={closeExpenseModal} className={`${commonButtonClass} bg-slate-200 hover:bg-slate-300 text-slate-700 focus:ring-slate-400`}>Cancel</button>
            <button type="submit" className={`${commonButtonClass} bg-brandBlue hover:bg-brandBlue-dark focus:ring-brandBlue`}>{editingExpense ? 'Save Changes' : 'Add Expense'}</button>
          </div>
        </form>
      </Modal>
      
      <Modal isOpen={isProductModalOpen} onClose={closeProductModal} title={editingProduct ? "Edit Product" : "Add New Product"} size="md">
        <form onSubmit={(e) => { e.preventDefault(); handleSaveProduct(); }} className="space-y-4">
            <div>
                <label htmlFor="productName" className={commonLabelClass}>Product Name</label>
                <input type="text" name="name" id="productName" value={productFormData.name} onChange={handleProductFormChange} className={commonInputClass} required />
            </div>
            <div>
                <label htmlFor="productPrice" className={commonLabelClass}>Selling Price (₹)</label>
                <input type="number" name="price" id="productPrice" value={productFormData.price} onChange={handleProductFormChange} className={commonInputClass} required min="0.01" step="0.01" />
            </div>
            <div>
                <label htmlFor="productCostPrice" className={commonLabelClass}>Cost Price (₹)</label>
                <input type="number" name="costPrice" id="productCostPrice" value={productFormData.costPrice} onChange={handleProductFormChange} className={commonInputClass} required min="0" step="0.01" />
            </div>
            <div>
                <label htmlFor="productInitialStock" className={commonLabelClass}>Initial Stock</label>
                <input type="number" name="initialStock" id="productInitialStock" value={productFormData.initialStock} onChange={handleProductFormChange} className={commonInputClass} required min="0" step="1" />
            </div>
             <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={closeProductModal} className={`${commonButtonClass} bg-slate-200 hover:bg-slate-300 text-slate-700 focus:ring-slate-400`}>Cancel</button>
                <button type="submit" className={`${commonButtonClass} bg-brandBlue hover:bg-brandBlue-dark focus:ring-brandBlue`}>{editingProduct ? 'Save Changes' : 'Add Product'}</button>
            </div>
        </form>
      </Modal>

      <Modal isOpen={isImportConfirmationModalOpen} onClose={cancelImportData} title="Import Data" size="lg">
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            How would you like to import data from the selected file?
          </p>
          <fieldset className="space-y-4">
            <legend className="sr-only">Import Mode</legend>
            <div 
              className={`p-4 border rounded-lg cursor-pointer ${importMode === 'merge' ? 'border-brandBlue bg-brandBlue/5 ring-2 ring-brandBlue' : 'border-slate-300'}`}
              onClick={() => setImportMode('merge')}
            >
              <input
                id="import-merge"
                name="import-mode"
                type="radio"
                checked={importMode === 'merge'}
                onChange={() => setImportMode('merge')}
                className="h-4 w-4 text-brandBlue border-slate-300 focus:ring-brandBlue"
              />
              <label htmlFor="import-merge" className="ml-3 text-sm font-medium text-slate-900 cursor-pointer">
                Merge with Existing Data (Recommended)
              </label>
              <p className="ml-7 text-xs text-slate-500">
                Adds new records from your backup without deleting your current data. This is the safest way to combine information from multiple devices. Note: This may create logical duplicates if records were created separately on different devices. Use the Archival tool below to clean up old data periodically.
              </p>
            </div>

            <div 
              className={`p-4 border rounded-lg cursor-pointer ${importMode === 'replace' ? 'border-red-500 bg-red-50 ring-2 ring-red-500' : 'border-slate-300'}`}
              onClick={() => setImportMode('replace')}
            >
              <input
                id="import-replace"
                name="import-mode"
                type="radio"
                checked={importMode === 'replace'}
                onChange={() => setImportMode('replace')}
                className="h-4 w-4 text-red-600 border-slate-300 focus:ring-red-500"
              />
              <label htmlFor="import-replace" className="ml-3 text-sm font-medium text-red-900 cursor-pointer">
                Replace All Existing Data
              </label>
              <p className="ml-7 text-xs text-red-700">
                <strong>Warning:</strong> Deletes everything currently in the app. Any work done since the backup was created will be permanently lost.
              </p>
            </div>
          </fieldset>
          <div className="flex justify-end space-x-3 pt-4">
              <button 
                  onClick={cancelImportData} 
                  className={`${commonButtonClass} bg-slate-200 hover:bg-slate-300 text-slate-700 focus:ring-slate-400`}
              >
                  Cancel
              </button>
              <button 
                  onClick={confirmImportData} 
                  className={`${commonButtonClass} ${importMode === 'replace' ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : 'bg-brandBlue hover:bg-brandBlue-dark focus:ring-brandBlue'}`}
              >
                  Confirm Import
              </button>
          </div>
        </div>
      </Modal>
      
      <Modal isOpen={isConfirmationModalOpen} onClose={closeConfirmationModal} title={confirmationTitle} size="md">
        <div className="space-y-4">
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{confirmationMessage}</p>
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mt-2">
                <div className="flex">
                    <div className="flex-shrink-0">
                        {ICONS.delete('h-5 w-5 text-red-500')}
                    </div>
                    <div className="ml-3">
                        <p className="text-sm text-red-800 font-semibold">
                            Warning: This action is permanent and cannot be reversed.
                        </p>
                    </div>
                </div>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
                <button
                    onClick={closeConfirmationModal}
                    type="button"
                    className={`${commonButtonClass} bg-slate-200 hover:bg-slate-300 text-slate-700 focus:ring-slate-400`}
                >
                    Cancel
                </button>
                <button
                    onClick={handleConfirmDelete}
                    type="button"
                    className={`${commonButtonClass} bg-red-600 hover:bg-red-700 focus:ring-red-500`}
                >
                    Yes, Confirm
                </button>
            </div>
        </div>
      </Modal>

    </HashRouter>
  );
};

const Header: React.FC = () => (
  <header className="bg-white shadow-md p-4 sticky top-0 z-40 app-header">
    <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-2">
            {ICONS.jmBrandLogo('h-8 w-8')}
            <h1 className="text-2xl font-bold text-brandBlue-dark">{APP_NAME}</h1>
            <span className="text-sm text-slate-500 mt-1">for {COMPANY_NAME}</span>
        </div>
    </div>
  </header>
);

const Sidebar: React.FC = () => {
  const location = useLocation();
  const navItems = [
    { path: '/', label: 'Dashboard', icon: ICONS.dashboard },
    { path: '/customers', label: 'Customers', icon: ICONS.customers },
    { path: '/orders', label: 'Orders', icon: ICONS.orders },
    { path: '/future-orders', label: 'Future Orders', icon: ICONS.calendarDays },
    { path: '/delivery', label: 'Delivery Queue', icon: ICONS.delivery },
    { path: '/expenses', label: 'Expenses', icon: ICONS.receipt },
    // Removed: { path: '/insights', label: 'AI Insights', icon: ICONS.insights },
    { path: '/admin', label: 'Admin Panel', icon: ICONS.admin },
  ];

  return (
    <aside className="w-60 bg-brandBlue-dark text-white p-4 space-y-2 flex flex-col shadow-lg app-sidebar">
      <nav className="flex-grow">
        <ul>
          {navItems.map(item => (
            <li key={item.path}>
              <Link 
                to={item.path} 
                className={`flex items-center space-x-3 p-3 rounded-md hover:bg-brandBlue transition-colors ${location.pathname === item.path ? 'bg-brandBlue-light font-semibold shadow-inner' : ''}`}
                aria-current={location.pathname === item.path ? "page" : undefined}
              >
                {item.icon('w-5 h-5')}
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="text-center text-xs text-brandBlue-light opacity-75 pb-2">
         © {new Date().getFullYear()} {COMPANY_NAME}
      </div>
    </aside>
  );
};

interface CustomerTableProps {
  customers: Customer[];
  allOrders: Order[]; 
  onEdit: (customer: Customer) => void;
  onDelete: (customerId: string) => void;
  calculateCustomerOutstandingBalance: (customerId: string, allOrdersList: Order[], excludeOrderId?: string) => number;
}

const CustomerTable: React.FC<CustomerTableProps> = ({ customers, allOrders, onEdit, onDelete, calculateCustomerOutstandingBalance }) => (
  <div className="bg-white shadow-lg rounded-xl overflow-hidden">
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Contact</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">GSTIN</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Outstanding (₹)</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Added On</th>
            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-200">
          {customers.length === 0 && (
            <tr><td colSpan={7} className="text-center py-10 text-slate-500">No customers found.</td></tr>
          )}
          {customers.map(customer => {
            const outstandingBalance = calculateCustomerOutstandingBalance(customer.id, allOrders);
            const balanceColor = outstandingBalance > 0 ? 'text-red-600' : 'text-green-600';
            return (
              <tr key={customer.id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-6 py-4 whitespace-nowrap">
                  <Link to={`/customers/${customer.id}`} className="text-sm font-medium text-brandBlue hover:text-brandBlue-dark hover:underline" aria-label={`View ledger for ${customer.name}`}>
                    {customer.name}
                  </Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-slate-900">{customer.phone}</div>
                  <div className="text-xs text-slate-500 truncate max-w-xs">{customer.address}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${customer.type === CustomerType.SHOP ? 'bg-sky-100 text-sky-800' : 'bg-lime-100 text-lime-800'}`}>
                    {customer.type}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 font-mono">{customer.gstin || 'N/A'}</td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${balanceColor}`}>
                    {outstandingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{new Date(customer.createdAt).toLocaleDateString()}</td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                  <div className="flex items-center justify-center space-x-2">
                    <Link
                        to={`/customers/${customer.id}`}
                        className="text-indigo-500 hover:text-indigo-700 p-1 rounded-md hover:bg-indigo-500/10 transition-colors"
                        aria-label={`View ledger for ${customer.name}`}
                        title="View Ledger"
                    >
                        {ICONS.view('w-4 h-4')}
                    </Link>
                    <button onClick={() => onEdit(customer)} className="text-brandSky hover:text-brandSky-dark p-1 rounded-md hover:bg-brandSky/10 transition-colors" aria-label={`Edit ${customer.name}`}>
                      {ICONS.edit('w-4 h-4')}
                    </button>
                    <button onClick={() => onDelete(customer.id)} className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-500/10 transition-colors" aria-label={`Delete ${customer.name}`}>
                      {ICONS.delete('w-4 h-4')}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);


interface OrderTableProps {
  orders: Order[];
  allOrders: Order[]; 
  customers: Customer[]; 
  productsData: ProductType[];
  onEdit: (order: Order) => void;
  onDelete: (orderId: string) => void;
  getCustomerName: (customerId: string) => string;
  getOrderDisplayProducts: (items: OrderItem[]) => string;
  getOrderProductsListString: (items: OrderItem[]) => string; 
  getOrderDisplayQuantity: (items: OrderItem[]) => number;
  getStatusColor: (status: OrderStatus) => string;
  calculateCustomerOutstandingBalance: (customerId: string, allOrdersList: Order[], excludeOrderId?: string) => number;
  calculateCustomerCumulativeEmptyCanBalance: (customerId: string, allOrdersList: Order[], products: ProductType[], targetOrder: Order) => number; // Changed to Can
}

const OrderTable: React.FC<OrderTableProps> = ({ 
  orders: ordersToShow, allOrders, customers, productsData, onEdit, onDelete, 
  getCustomerName, getOrderDisplayProducts, getOrderProductsListString, getOrderDisplayQuantity, getStatusColor, 
  calculateCustomerOutstandingBalance, calculateCustomerCumulativeEmptyCanBalance // Changed to Can
}) => {
  const navigate = useNavigate();

  const generateInvoiceDataAndNavigate = (order: Order) => {
    const customer = customers.find(c => c.id === order.customerId);
    const orderItemsForInvoice = order.items.map(item => {
        const product = productsData.find(p => p.id === item.productId);
        return {
            productId: item.productId,
            productName: product ? product.name : 'Unknown Product',
            quantity: item.quantity,
            unitPrice: item.unitPrice, 
            hsn: '2201' 
        };
    });

    const params = new URLSearchParams({
        orderNumber: order.orderNumber,
        orderDate: new Date(order.orderDate).toLocaleDateString('en-CA'), 
        customerName: customer ? customer.name : 'N/A',
        customerAddress: customer ? customer.address : 'N/A',
        customerGstin: customer?.gstin || '',
        items: JSON.stringify(orderItemsForInvoice)
    });
    navigate(`/invoice?${params.toString()}`);
  };

  return (
    <div className="bg-white shadow-lg rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Order #</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Customer</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date & Time</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Products</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Qty</th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider" title="20L Cans Returned (This Order)">C.Rtn.</th> 
              <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider" title="Cumulative 20L Cans Balance">C.Bal.</th> 
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Total (₹)</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Paid (₹)</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Balance (₹)</th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {ordersToShow.length === 0 && (
              <tr><td colSpan={12} className="text-center py-10 text-slate-500">No orders found matching your criteria.</td></tr>
            )}
            {ordersToShow.map(order => {
              const customerOutstanding = calculateCustomerOutstandingBalance(order.customerId, allOrders);
              const customer = customers.find(c => c.id === order.customerId);
              const twentyLitreCanProductInfo = productsData.find(p => p.name.toLowerCase() === '20l can'); // Changed to can
              const orderHas20LCanItem = twentyLitreCanProductInfo && order.items.some(item => item.productId === twentyLitreCanProductInfo.id); // Changed to can
              
              let cumulativeCanBalanceForDisplay = 0; // Changed
              if (orderHas20LCanItem || typeof order.emptyJarsReturned === 'number') { // Field name from type
                 cumulativeCanBalanceForDisplay = calculateCustomerCumulativeEmptyCanBalance(order.customerId, allOrders, productsData, order); // Changed
              }

              return (
                <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm font-medium text-brandBlue hover:text-brandBlue-dark">{order.orderNumber}</div>
                    {order.place && <div className="text-xs text-slate-500">{order.place}</div>}
                  </td>
                   <td className="px-4 py-3 whitespace-nowrap">
                    {customer ? (
                      <Link to={`/customers/${customer.id}`} className="text-sm font-medium text-brandBlue hover:text-brandBlue-dark hover:underline" aria-label={`View ledger for ${getCustomerName(order.customerId)}`}>
                        {getCustomerName(order.customerId)}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium text-slate-700">{getCustomerName(order.customerId)}</span>
                    )}
                    <div className={`text-xs ${customerOutstanding > 0 ? 'text-red-500' : 'text-slate-500'}`}>
                      Bal: ₹{customerOutstanding.toLocaleString('en-IN')}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                    {new Date(order.orderDate).toLocaleDateString('en-GB')}
                    <div className="text-xs text-slate-400">
                        {new Date(order.orderDate).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 max-w-xs truncate" title={getOrderProductsListString(order.items)}>{getOrderDisplayProducts(order.items)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 text-right">{getOrderDisplayQuantity(order.items)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 text-center">
                    {(orderHas20LCanItem || typeof order.emptyJarsReturned === 'number') && typeof order.emptyJarsReturned === 'number' ? order.emptyJarsReturned : <span className="text-slate-400">N/A</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                    {(orderHas20LCanItem || typeof order.emptyJarsReturned === 'number') ? ( // Changed
                      <span className={cumulativeCanBalanceForDisplay > 0 ? 'text-red-500 font-semibold' : (cumulativeCanBalanceForDisplay === 0 ? 'text-green-500' : 'text-blue-500') }>
                        {cumulativeCanBalanceForDisplay}
                      </span>
                    ) : <span className="text-slate-400">N/A</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-800 font-semibold text-right">
                    {order.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-green-600 font-semibold text-right">
                    {order.amountPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className={`px-4 py-3 whitespace-nowrap text-sm font-semibold text-right ${order.balanceAmount > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                    {order.balanceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full text-white ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-medium">
                    <div className="flex items-center justify-center space-x-1">
                      <button onClick={() => onEdit(order)} className="text-brandSky hover:text-brandSky-dark p-1 rounded-md hover:bg-brandSky/10 transition-colors" aria-label={`Edit order ${order.orderNumber}`}>
                        {ICONS.edit('w-4 h-4')}
                      </button>
                      <button onClick={() => generateInvoiceDataAndNavigate(order)} className="text-teal-500 hover:text-teal-700 p-1 rounded-md hover:bg-teal-500/10 transition-colors" aria-label={`Generate invoice for ${order.orderNumber}`}>
                         {ICONS.invoice('w-4 h-4')}
                      </button>
                      <button onClick={() => onDelete(order.id)} className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-500/10 transition-colors" aria-label={`Delete order ${order.orderNumber}`}>
                         {ICONS.delete('w-4 h-4')}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface ExpensesPageProps {
  expenses: Expense[];
  onAddExpense: () => void;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (expenseId: string) => void;
  globalSearchTerm: string;
  setGlobalSearchTerm: (term: string) => void;
  onExportExpenses: (expensesToExport: Expense[]) => void;
}

const ExpensesPage: React.FC<ExpensesPageProps> = ({
  expenses, onAddExpense, onEditExpense, onDeleteExpense, 
  globalSearchTerm, setGlobalSearchTerm, onExportExpenses
}) => {
  const [localSearchTerm, setLocalSearchTerm] = useState(globalSearchTerm);
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | 'All'>('All');
  const [dateFilter, setDateFilter] = useState<string>('');

  useEffect(() => { 
    setLocalSearchTerm(globalSearchTerm);
  }, [globalSearchTerm]);

  const handleSearchChange = (term: string) => {
    setLocalSearchTerm(term);
    setGlobalSearchTerm(term); 
  };

  const filteredExpenses = useMemo(() => {
    return expenses
      .filter(exp => {
        const searchTermLower = localSearchTerm.toLowerCase();
        const searchMatch = (
          exp.description.toLowerCase().includes(searchTermLower) ||
          (exp.vendor && exp.vendor.toLowerCase().includes(searchTermLower)) ||
          exp.amount.toString().includes(localSearchTerm) ||
          exp.category.toLowerCase().includes(searchTermLower)
        );
        const categoryMatch = categoryFilter === 'All' || exp.category === categoryFilter;
        const dateMatch = dateFilter ? isSameDay(exp.date, dateFilter) : true;
        return searchMatch && categoryMatch && dateMatch;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, localSearchTerm, categoryFilter, dateFilter]);

  return (
    <PageWrapper
      title="Expenses"
      showAddButton
      onAdd={onAddExpense}
      addButtonLabel="Add Expense"
      searchTerm={localSearchTerm}
      onSearchTermChange={handleSearchChange}
      showExpenseCategoryFilter
      expenseCategoryFilterValue={categoryFilter}
      onExpenseCategoryFilterChange={setCategoryFilter}
      showDateFilter
      dateFilterValue={dateFilter}
      onDateFilterChange={setDateFilter}
      onClearDateFilter={() => setDateFilter('')}
      showExportButton
      onExport={() => onExportExpenses(filteredExpenses)}
      exportButtonLabel="Export Expenses (CSV)"
      exportDisabled={filteredExpenses.length === 0}
    >
      <ExpenseTable
        expenses={filteredExpenses}
        onEdit={onEditExpense}
        onDelete={onDeleteExpense}
      />
    </PageWrapper>
  );
};

interface ExpenseTableProps {
  expenses: Expense[];
  onEdit: (expense: Expense) => void;
  onDelete: (expenseId: string) => void;
}

const ExpenseTable: React.FC<ExpenseTableProps> = ({ expenses, onEdit, onDelete }) => (
  <div className="bg-white shadow-lg rounded-xl overflow-hidden">
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Category</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Description</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Vendor</th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Amount (₹)</th>
            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-200">
          {expenses.length === 0 && (
            <tr><td colSpan={6} className="text-center py-10 text-slate-500">No expenses found.</td></tr>
          )}
          {expenses.map(expense => (
            <tr key={expense.id} className="hover:bg-slate-50 transition-colors group">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{new Date(expense.date).toLocaleDateString()}</td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800`}>
                  {expense.category}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-normal max-w-sm text-sm text-slate-900">{expense.description}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{expense.vendor || 'N/A'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800 font-semibold text-right">
                {expense.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                <div className="flex items-center justify-center space-x-2">
                  <button onClick={() => onEdit(expense)} className="text-brandSky hover:text-brandSky-dark p-1 rounded-md hover:bg-brandSky/10 transition-colors" aria-label={`Edit expense: ${expense.description}`}>
                    {ICONS.edit('w-4 h-4')}
                  </button>
                  <button onClick={() => onDelete(expense.id)} className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-500/10 transition-colors" aria-label={`Delete expense: ${expense.description}`}>
                    {ICONS.delete('w-4 h-4')}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

interface DashboardPageProps {
  stats: StatSummary;
  recentOrders: Order[];
  getCustomerName: (customerId: string) => string;
  getOrderDisplayProducts: (items: OrderItem[]) => string;
  getOrderDisplayQuantity: (items: OrderItem[]) => number;
  getStatusColor: (status: OrderStatus) => string;
  inventory: InventoryData;
  productsData: ProductType[];
}

const DashboardPage: React.FC<DashboardPageProps> = ({ 
    stats, recentOrders, getCustomerName, getOrderDisplayProducts, getOrderDisplayQuantity, getStatusColor,
    inventory, productsData
 }) => {
  
  const formatCurrency = (value: number) => `₹${value.toLocaleString('en-IN', {minimumFractionDigits:0, maximumFractionDigits:0})}`;

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
        <StatCard title="Today's Sales" value={formatCurrency(stats.todaysSales)} icon={ICONS.trendingUp("w-7 h-7 text-white")} color="bg-green-500" />
        <StatCard title="Today's Income" value={formatCurrency(stats.todaysIncome)} icon={ICONS.wallet("w-7 h-7 text-white")} color="bg-sky-500" />
        <StatCard title="Today's Orders" value={stats.todaysOrdersCount} icon={ICONS.orders("w-7 h-7 text-white")} color="bg-amber-500" />
        <StatCard title="Today's Expenses" value={formatCurrency(stats.todaysExpenses)} icon={ICONS.receipt("w-7 h-7 text-white")} color="bg-red-500" />
        <StatCard title="This Month's Sales" value={formatCurrency(stats.thisMonthSales)} icon={ICONS.trendingUp("w-7 h-7 text-white")} color="bg-pink-500" />
        <StatCard title="This Month's Income" value={formatCurrency(stats.thisMonthIncome)} icon={ICONS.wallet("w-7 h-7 text-white")} color="bg-purple-500" />
        <StatCard title="This Month's Expenses" value={formatCurrency(stats.thisMonthExpenses)} icon={ICONS.receipt("w-7 h-7 text-white")} color="bg-rose-500" />
        <StatCard title="Pending/Dispatch (Active)" value={stats.pendingOrders} icon={ICONS.delivery("w-7 h-7 text-white")} color="bg-yellow-500" />
        <StatCard title="Scheduled Orders" value={stats.scheduledOrdersCount} icon={ICONS.calendarDays("w-7 h-7 text-white")} color="bg-indigo-500" />
        <StatCard title="Delivered Orders" value={stats.deliveredOrders} icon={ICONS.orders("w-7 h-7 text-white")} color="bg-teal-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg">
          <h2 className="text-xl font-semibold text-slate-700 mb-4">Product Stock Levels</h2>
          {productsData.length === 0 ? (
            <p className="text-sm text-slate-500">No products available to display stock levels.</p>
          ) : (
            <div className="overflow-y-auto max-h-96"> {/* Added scroll for many products */}
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Product Name</th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Current Stock</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {productsData.sort((a,b) => a.name.localeCompare(b.name)).map(product => {
                    const currentStock = inventory[product.id] || 0;
                    const initialStock = product.initialStock; 
                    const stockPercentage = initialStock > 0 ? (currentStock / initialStock) : 0;
                    // Low stock if current stock < 10 OR if initial stock was >0 and current is < 20% of initial
                    const isLowStock = currentStock < 10 || (initialStock > 0 && stockPercentage < 0.2);
                    return (
                      <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-800">{product.name}</td>
                        <td className={`px-4 py-3 whitespace-nowrap text-sm font-semibold text-right ${isLowStock ? 'text-red-500' : 'text-slate-700'}`}>
                          {currentStock} unit{currentStock !== 1 ? 's' : ''}
                          {isLowStock && <span className="ml-2 text-xs">(Low Stock)</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-lg"> {/* Changed from lg:col-span-1 */}
          <h2 className="text-xl font-semibold text-slate-700 mb-4">Recent Orders</h2>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-slate-500">No recent orders to display.</p>
          ) : (
            <ul className="space-y-3 max-h-96 overflow-y-auto"> {/* Added scroll for many orders */}
              {recentOrders.map(order => (
                <li key={order.id} className="p-3 bg-slate-50 rounded-lg hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-center">
                    <Link to={`/orders`} state={{ defaultSearch: order.orderNumber }} className="font-medium text-brandBlue hover:underline">{order.orderNumber}</Link>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full text-white ${getStatusColor(order.status)}`}>{order.status}</span>
                  </div>
                  <p className="text-sm text-slate-600">{getCustomerName(order.customerId)}</p>
                  <p className="text-xs text-slate-500">{getOrderDisplayProducts(order.items)} - Qty: {getOrderDisplayQuantity(order.items)}</p>
                  <div className="text-sm font-semibold text-slate-700 mt-1">₹{order.totalAmount.toLocaleString('en-IN')}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

interface DeliveryViewProps {
  orders: Order[];
  allOrders: Order[]; 
  updateOrderStatus: (orderId: string, newStatus: OrderStatus) => void;
  getCustomerName: (customerId: string) => string;
  getProductName: (productId: string) => string;
  getStatusColor: (status: OrderStatus) => string;
  customers: Customer[];
  productsData: ProductType[];
  calculateCustomerCumulativeEmptyCanBalance: (customerId: string, allOrdersList: Order[], products: ProductType[], targetOrder: Order) => number; // Changed
}

const DeliveryView: React.FC<DeliveryViewProps> = ({ 
  orders: ordersToDeliver, allOrders, updateOrderStatus, getCustomerName, getProductName, getStatusColor, customers, productsData, calculateCustomerCumulativeEmptyCanBalance // Changed
}) => {
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const twentyLitreCanProduct = productsData.find(p => p.name.toLowerCase() === '20l can'); // Changed

  const toggleOrderExpansion = (orderId: string) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };
  
  const getCustomerPhone = (customerId: string) => customers.find(c=> c.id === customerId)?.phone;

  return (
    <div className="space-y-4">
      {ordersToDeliver.length === 0 && (
        <div className="text-center py-10 text-slate-500 bg-white rounded-lg shadow">
          <p className="text-xl">No orders in the delivery queue for today or past due.</p>
        </div>
      )}
      {ordersToDeliver.map(order => {
        const orderHas20LCanItem = twentyLitreCanProduct && order.items.some(item => item.productId === twentyLitreCanProduct.id); // Changed
        const twentyLCansInThisOrder = orderHas20LCanItem ? order.items.find(i => i.productId === twentyLitreCanProduct?.id)?.quantity || 0 : 0; // Changed
        
        let cumulativeCanBalanceForDisplay = 0; // Changed
        if (orderHas20LCanItem || typeof order.emptyJarsReturned === 'number') { // Field name from type
            cumulativeCanBalanceForDisplay = calculateCustomerCumulativeEmptyCanBalance(order.customerId, allOrders, productsData, order); // Changed
        }
        
        return (
          <div key={order.id} className="bg-white shadow-lg rounded-xl overflow-hidden">
            <div className="p-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div>
                  <h3 className="text-lg font-semibold text-brandBlue">{order.orderNumber}</h3>
                  <p className="text-sm text-slate-600">
                    <Link to={`/customers/${order.customerId}`} className="hover:underline" aria-label={`View ledger for ${getCustomerName(order.customerId)}`}>
                      {getCustomerName(order.customerId)}
                    </Link> 
                    {getCustomerPhone(order.customerId) && <a href={`tel:${getCustomerPhone(order.customerId)}`} className="ml-2 text-brandSky hover:text-brandSky-dark">({getCustomerPhone(order.customerId)})</a>}
                  </p>
                  <p className="text-xs text-slate-500">{new Date(order.orderDate).toLocaleString('en-GB')}</p>
                  {order.place && <p className="text-xs text-slate-500">Place: {order.place}</p>}
                </div>
                <div className="mt-2 sm:mt-0 flex flex-col items-start sm:items-end">
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full text-white ${getStatusColor(order.status)}`}>
                    {order.status}
                  </span>
                  <p className="text-lg font-bold text-slate-800 mt-1">₹{order.totalAmount.toLocaleString()}</p>
                </div>
              </div>

              <button
                onClick={() => toggleOrderExpansion(order.id)}
                className="text-sm text-brandBlue hover:underline mt-3 flex items-center"
                aria-expanded={expandedOrder === order.id}
                aria-controls={`order-details-${order.id}`}
              >
                {expandedOrder === order.id ? 'Hide Details' : 'Show Details'}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 ml-1 transform transition-transform ${expandedOrder === order.id ? 'rotate-180' : ''}`}>
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.23 8.29a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </button>

              {expandedOrder === order.id && (
                <div id={`order-details-${order.id}`} className="mt-3 pt-3 border-t border-slate-200">
                  <h4 className="text-sm font-semibold text-slate-700 mb-1">Items:</h4>
                  <ul className="list-disc list-inside text-sm text-slate-600 space-y-0.5">
                    {order.items.map(item => (
                      <li key={item.productId}>{getProductName(item.productId)} - Qty: {item.quantity}</li>
                    ))}
                  </ul>
                  {(orderHas20LCanItem || typeof order.emptyJarsReturned === 'number') && ( // Changed
                    <div className="mt-2 text-sm text-slate-700 p-2 bg-sky-50 rounded-md border border-sky-200">
                      <p><strong>20L Can Details:</strong></p> 
                      {orderHas20LCanItem && <p className="ml-2">Cans Taken This Order: {twentyLCansInThisOrder}</p>} 
                      {typeof order.emptyJarsReturned === 'number' && <p className="ml-2">Cans Returned This Order: {order.emptyJarsReturned}</p>} 
                      <p className={`ml-2 ${cumulativeCanBalanceForDisplay > 0 ? 'text-red-600 font-semibold' : (cumulativeCanBalanceForDisplay === 0 ? 'text-green-600' : 'text-blue-500')}`}>
                          Cumulative Can Balance: {cumulativeCanBalanceForDisplay} 
                      </p>
                    </div>
                  )}
                  {order.deliveryNotes && <p className="text-sm text-slate-600 mt-2"><strong>Notes:</strong> {order.deliveryNotes}</p>}
                   <p className="text-sm text-slate-600 mt-2"><strong>Address:</strong> {customers.find(c=>c.id === order.customerId)?.address}</p>
                </div>
              )}
            </div>
            <div className="bg-slate-50 p-3 flex justify-end space-x-2">
              {order.status === OrderStatus.PENDING && (
                <button
                  onClick={() => updateOrderStatus(order.id, OrderStatus.DISPATCHED)}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-md shadow-sm transition-colors"
                >
                  Mark Dispatched
                </button>
              )}
              {order.status === OrderStatus.DISPATCHED && (
                <button
                  onClick={() => updateOrderStatus(order.id, OrderStatus.DELIVERED)}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-green-500 hover:bg-green-600 rounded-md shadow-sm transition-colors"
                >
                  Mark Delivered
                </button>
              )}
              {order.status !== OrderStatus.CANCELLED && order.status !== OrderStatus.DELIVERED && (
                   <button
                      onClick={() => updateOrderStatus(order.id, OrderStatus.CANCELLED)}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-md shadow-sm transition-colors"
                    >
                     Mark Cancelled
                    </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  );
};


interface AdminPanelProps {
  productsData: ProductType[];
  inventory: InventoryData;
  onAddStock: (productId: string, quantity: number) => void;
  onOpenProductModal: (product?: ProductType) => void;
  onExportAllData: () => void;
  onImportAllData: () => void;
  onArchiveOrders: (cutoff: '6m' | '1y' | '2y') => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ 
  productsData, inventory, onAddStock, onOpenProductModal, onExportAllData, onImportAllData, onArchiveOrders
}) => {
  const [stockProductId, setStockProductId] = useState<string>('');
  const [stockQuantity, setStockQuantity] = useState<string>('');
  const [archiveCutoff, setArchiveCutoff] = useState<'6m' | '1y' | '2y'>('1y');

  const handleAddStockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockProductId || !stockQuantity) {
      alert("Please select a product and enter quantity.");
      return;
    }
    const quantityNum = parseInt(stockQuantity, 10);
    if (isNaN(quantityNum) || quantityNum <= 0) {
      alert("Please enter a valid positive quantity.");
      return;
    }
    onAddStock(stockProductId, quantityNum);
    setStockProductId('');
    setStockQuantity('');
    alert("Stock added successfully!");
  };

  const handleArchiveClick = () => {
    onArchiveOrders(archiveCutoff);
  }

  return (
    <div className="space-y-8">
      
      <section className="bg-white p-6 rounded-xl shadow-lg">
        <h2 className="text-xl font-semibold text-slate-700 mb-4 flex items-center">
            {ICONS.productsIcon('w-6 h-6 mr-2 text-brandBlue')} Product & Inventory Management
        </h2>
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <p className="text-sm text-slate-600">
                Manage your product listings and current inventory levels.
            </p>
            <button
                onClick={() => onOpenProductModal()}
                className="bg-teal-500 hover:bg-teal-600 text-white font-semibold py-2 px-4 rounded-md shadow-sm hover:shadow-lg transition duration-150 ease-in-out flex items-center gap-2"
            >
                {ICONS.add()} Add/Edit Product
            </button>
        </div>
        
        <div className="overflow-x-auto mb-6">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Product</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Sell Price (₹)</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Cost Price (₹)</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Initial Stock</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Current Stock</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {productsData.sort((a,b) => a.name.localeCompare(b.name)).map(product => (
                <tr key={product.id} className="hover:bg-slate-50 group">
                  <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-slate-800">{product.name}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-slate-600 text-right">{product.price.toFixed(2)}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-slate-600 text-right">{product.costPrice.toFixed(2)}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-slate-600 text-right">{product.initialStock}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm font-semibold text-right {(inventory[product.id] || 0) < 10 ? 'text-red-500' : 'text-slate-800'}">
                    {inventory[product.id] || 0}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-center">
                     <button 
                        onClick={() => onOpenProductModal(product)} 
                        className="text-brandSky hover:text-brandSky-dark p-1 rounded-md hover:bg-brandSky/10 transition-colors"
                        aria-label={`Edit ${product.name}`}
                      >
                          {ICONS.edit('w-4 h-4')}
                      </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form onSubmit={handleAddStockSubmit} className="space-y-3 sm:space-y-0 sm:flex sm:items-end sm:space-x-3 p-4 border border-dashed border-slate-300 rounded-lg bg-slate-50">
          <div className="flex-grow">
            <label htmlFor="stockProductId" className="block text-sm font-medium text-slate-700">Product</label>
            <select 
              id="stockProductId" 
              value={stockProductId} 
              onChange={(e) => setStockProductId(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm text-slate-900 focus:outline-none focus:border-brandSky focus:ring-1 focus:ring-brandSky"
              required
            >
              <option value="" className="text-slate-500">Select Product to Add Stock</option>
              {productsData.map(p => <option key={p.id} value={p.id} className="text-slate-900">{p.name}</option>)}
            </select>
          </div>
          <div className="sm:w-1/4">
            <label htmlFor="stockQuantity" className="block text-sm font-medium text-slate-700">Quantity to Add</label>
            <input 
              type="number" 
              id="stockQuantity" 
              value={stockQuantity}
              onChange={(e) => setStockQuantity(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brandSky focus:ring-1 focus:ring-brandSky"
              min="1"
              required
              placeholder="e.g., 50"
            />
          </div>
          <button 
            type="submit"
            className="w-full sm:w-auto bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-md shadow-sm hover:shadow-lg transition duration-150 ease-in-out flex items-center justify-center gap-1"
          >
            {ICONS.add('w-4 h-4')} Add Stock
          </button>
        </form>
      </section>

      <section className="bg-white p-6 rounded-xl shadow-lg">
          <h2 className="text-xl font-semibold text-slate-700 mb-4 flex items-center">
            {ICONS.data('w-6 h-6 mr-2 text-brandBlue')} Data Management
          </h2>
          <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium text-slate-800">Backup & Restore</h3>
                <p className="text-sm text-slate-600 mt-1 mb-3">
                    Export all your CRM data for backup. Import a backup file to merge or replace existing data.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                    <button
                        onClick={onExportAllData}
                        className="bg-brandSky hover:bg-brandSky-dark text-white font-semibold py-2.5 px-5 rounded-md shadow-md hover:shadow-lg transition duration-150 ease-in-out flex items-center justify-center gap-2"
                    >
                        {ICONS.download()} Export All Data
                    </button>
                    <button
                        onClick={onImportAllData}
                        className="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 px-5 rounded-md shadow-md hover:shadow-lg transition duration-150 ease-in-out flex items-center justify-center gap-2"
                    >
                        {ICONS.upload()} Import from Backup
                    </button>
                </div>
            </div>
            <div className="border-t border-slate-200 pt-6">
                <h3 className="text-lg font-medium text-slate-800">Archive Old Data</h3>
                <p className="text-sm text-slate-600 mt-1 mb-3">
                    To free up storage and keep the app running fast, you can permanently archive old, fulfilled (Delivered or Cancelled) orders. This action does not affect your financial totals or inventory counts.
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="flex-grow">
                        <label htmlFor="archiveCutoff" className="sr-only">Archive orders older than</label>
                        <select
                          id="archiveCutoff"
                          value={archiveCutoff}
                          onChange={(e) => setArchiveCutoff(e.target.value as '6m' | '1y' | '2y')}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm text-slate-900 focus:outline-none focus:border-brandSky focus:ring-1 focus:ring-brandSky"
                        >
                            <option value="6m">Older than 6 months</option>
                            <option value="1y">Older than 1 year</option>
                            <option value="2y">Older than 2 years</option>
                        </select>
                    </div>
                    <button
                        onClick={handleArchiveClick}
                        className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-md shadow-md hover:shadow-lg transition duration-150 ease-in-out flex items-center justify-center gap-2"
                    >
                        {ICONS.delete('w-4 h-4')} Archive Fulfilled Orders
                    </button>
                </div>
            </div>
          </div>
      </section>

    </div>
  );
};
