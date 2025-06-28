
import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Customer, Order, OrderItem, OrderStatus, Product as ProductType } from './types';
import { ICONS } from './constants';

interface CustomerLedgerPageProps {
  customers: Customer[];
  allOrders: Order[];
  productsData: ProductType[];
  onEditOrder: (order: Order) => void;
  getOrderDisplayProducts: (items: OrderItem[]) => string; 
  getStatusColor: (status: OrderStatus) => string;
  calculateCustomerOutstandingBalance: (customerId: string, allOrdersList: Order[], excludeOrderId?: string) => number;
  calculateCustomerCumulativeEmptyCanBalance: (customerId: string, allOrdersList: Order[], products: ProductType[], targetOrder: Order) => number; // Changed Jar to Can
}

const CustomerLedgerPage: React.FC<CustomerLedgerPageProps> = ({
  customers,
  allOrders,
  productsData,
  onEditOrder,
  getOrderDisplayProducts, 
  getStatusColor,
  calculateCustomerOutstandingBalance,
  calculateCustomerCumulativeEmptyCanBalance, // Changed Jar to Can
}) => {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();

  const customer = customers.find(c => c.id === customerId);
  const customerOrders = allOrders
    .filter(order => order.customerId === customerId)
    .sort((a, b) => {
        const dateA = new Date(a.orderDate).getTime();
        const dateB = new Date(b.orderDate).getTime();
        if (dateB !== dateA) {
          return dateB - dateA; 
        }
        return b.id.localeCompare(a.id); 
    });
  
  const twentyLitreCanProduct = productsData.find(p => p.name.toLowerCase() === '20l can'); // Changed to can

  const handleExportLedgerToPDF = () => {
    if (!customer) return;

    const ordersForPDF = allOrders
        .filter(order => order.customerId === customerId)
        .sort((a,b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());

    const totalOrderValue = ordersForPDF
        .filter(order => order.status !== OrderStatus.CANCELLED)
        .reduce((sum, order) => sum + order.totalAmount, 0);

    const totalAmountPaidByCustomer = ordersForPDF
        .filter(order => order.status !== OrderStatus.CANCELLED)
        .reduce((sum, order) => sum + order.amountPaid, 0);
    
    const overallOutstandingBalance = calculateCustomerOutstandingBalance(customer.id, allOrders);

    const formatCurrency = (value: number) => value.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });

    const tableRows = ordersForPDF.map(order => `
        <tr>
            <td>${order.orderNumber}</td>
            <td>${new Date(order.orderDate).toLocaleDateString('en-GB')}</td>
            <td class="products-cell">${getOrderDisplayProducts(order.items)}</td>
            <td class="num-cell">${order.totalAmount.toFixed(2)}</td>
            <td class="num-cell">${order.amountPaid.toFixed(2)}</td>
            <td class="num-cell">${order.balanceAmount.toFixed(2)}</td>
            <td><span class="status-${order.status.toLowerCase()}">${order.status}</span></td>
        </tr>
    `).join('');

    const styles = `
        body { font-family: 'Arial', sans-serif; font-size: 10pt; color: #333; }
        .ledger-container { padding: 30px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #3b82f6; padding-bottom: 15px; margin-bottom: 20px; }
        .company-details h1 { color: #3b82f6; margin: 0; font-size: 24pt; }
        .company-details p { margin: 2px 0; font-size: 9pt; color: #555; }
        .ledger-title h2 { text-align: right; margin: 0; font-size: 18pt; color: #333; }
        .ledger-title p { text-align: right; margin: 2px 0; font-size: 9pt; color: #555; }
        .customer-details { background-color: #f9fafb; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 20px; }
        .customer-details h3 { margin-top: 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; font-size: 12pt; }
        .customer-details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 15px; font-size: 9pt; }
        .summary-cards { display: flex; justify-content: space-between; gap: 15px; margin-bottom: 25px; text-align: center; }
        .card { flex: 1; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb; }
        .card-label { font-size: 9pt; margin-bottom: 5px; color: #4b5563 }
        .card-value { font-size: 14pt; font-weight: bold; }
        .card-value-orders { color: #1f2937; } .card-bg-orders { background-color: #f3f4f6; }
        .card-value-paid { color: #047857; } .card-bg-paid { background-color: #d1fae5; }
        .card-value-due { color: #b91c1c; } .card-bg-due { background-color: #fee2e2; }
        table { width: 100%; border-collapse: collapse; font-size: 9pt; }
        th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; word-break: break-word; }
        th { background-color: #f9fafb; font-weight: 600; }
        .num-cell { text-align: right; }
        .footer { text-align: center; margin-top: 20px; font-size: 8pt; color: #9ca3af; }
        .status-delivered { color: #16a34a; font-weight: bold; }
        .status-pending { color: #f59e0b; font-weight: bold; }
        .status-dispatched { color: #3b82f6; font-weight: bold; }
        .status-cancelled { color: #ef4444; font-weight: bold; text-decoration: line-through; }
    `;

    const htmlContent = `
        <html>
            <head><style>${styles}</style></head>
            <body>
                <div class="ledger-container">
                    <div class="header">
                        <div class="company-details">
                            <h1>JM Aqua Minerals</h1>
                            <p>No.3/83A, Nalankattalai Road, Iyanthnkattalai, Alangulam</p>
                            <p>GSTIN: 33EDKPM3576E1ZF</p>
                        </div>
                        <div class="ledger-title">
                            <h2>Customer Ledger</h2>
                            <p>Generated on: ${new Date().toLocaleDateString('en-GB')}</p>
                        </div>
                    </div>
                    <div class="customer-details">
                        <h3>${customer.name}</h3>
                        <div class="customer-details-grid">
                            <div><strong>Address:</strong> ${customer.address}</div>
                            <div><strong>Phone:</strong> ${customer.phone}</div>
                            <div><strong>Type:</strong> ${customer.type}</div>
                            <div><strong>GSTIN:</strong> ${customer.gstin || 'N/A'}</div>
                        </div>
                    </div>
                    <div class="summary-cards">
                        <div class="card card-bg-orders">
                            <div class="card-label">Total Order Value</div>
                            <div class="card-value card-value-orders">${formatCurrency(totalOrderValue)}</div>
                        </div>
                        <div class="card card-bg-paid">
                            <div class="card-label">Total Paid</div>
                            <div class="card-value card-value-paid">${formatCurrency(totalAmountPaidByCustomer)}</div>
                        </div>
                        <div class="card card-bg-due">
                            <div class="card-label">Outstanding Balance</div>
                            <div class="card-value card-value-due">${formatCurrency(overallOutstandingBalance)}</div>
                        </div>
                    </div>
                    <h3>Order History</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Order #</th>
                                <th>Date</th>
                                <th>Products</th>
                                <th class="num-cell">Total (₹)</th>
                                <th class="num-cell">Paid (₹)</th>
                                <th class="num-cell">Balance (₹)</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                    <div class="footer">
                        This is a computer-generated document.
                    </div>
                </div>
            </body>
        </html>
    `;

    const element = document.createElement('div');
    element.innerHTML = htmlContent;

    const html2pdf = (window as any).html2pdf;
    if (!html2pdf) {
        alert("PDF generation library is not available.");
        return;
    }

    const safeCustomerName = customer.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `Ledger_${safeCustomerName}_${timestamp}.pdf`;

    html2pdf().from(element).set({
        margin: 0.5,
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    }).save();
  };

  if (!customer) {
    return (
      <div className="p-6 text-center">
        <h1 className="text-2xl font-bold text-slate-700 mb-4">Customer Not Found</h1>
        <p className="text-slate-500">The customer you are looking for does not exist.</p>
        <button
          onClick={() => navigate('/customers')}
          className="mt-6 bg-brandBlue hover:bg-brandBlue-dark text-white font-semibold py-2 px-4 rounded-md shadow-md hover:shadow-lg transition duration-150 ease-in-out"
        >
          Back to Customers List
        </button>
      </div>
    );
  }

  const totalOrderValue = customerOrders
    .filter(order => order.status !== OrderStatus.CANCELLED)
    .reduce((sum, order) => sum + order.totalAmount, 0);

  const totalAmountPaidByCustomer = customerOrders
    .filter(order => order.status !== OrderStatus.CANCELLED)
    .reduce((sum, order) => sum + order.amountPaid, 0);
  
  const overallOutstandingBalance = calculateCustomerOutstandingBalance(customer.id, allOrders);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 gap-3">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
          Customer Ledger: <span className="text-brandBlue">{customer.name}</span>
        </h1>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button
              onClick={() => navigate('/customers')}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-2 px-4 rounded-md shadow-sm hover:shadow-md transition duration-150 ease-in-out flex items-center justify-center gap-2 text-sm"
              aria-label="Back to customers list"
            >
              {ICONS.customers('w-4 h-4')} Back to Customers
            </button>
            <button
              onClick={handleExportLedgerToPDF}
              disabled={customerOrders.length === 0}
              className="bg-teal-500 hover:bg-teal-600 text-white font-semibold py-2 px-4 rounded-md shadow-sm hover:shadow-md transition duration-150 ease-in-out flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Download customer ledger as PDF"
            >
              {ICONS.download('w-4 h-4')} Download PDF
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer Information Card */}
        <div className="lg:col-span-1 bg-white p-5 rounded-xl shadow-lg">
          <h2 className="text-lg font-semibold text-slate-700 mb-3 border-b pb-2">Customer Details</h2>
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
            <strong className="text-slate-500 font-semibold text-right">Phone:</strong>
            <span className="text-slate-800 font-medium">{customer.phone}</span>

            <strong className="text-slate-500 font-semibold text-right">Address:</strong>
            <span className="text-slate-800 font-medium break-words">{customer.address}</span>

            <strong className="text-slate-500 font-semibold text-right">Type:</strong>
            <span className="text-slate-800 font-medium">{customer.type}</span>

            <strong className="text-slate-500 font-semibold text-right">GSTIN:</strong>
            <span className="text-slate-800 font-medium font-mono">{customer.gstin || 'N/A'}</span>

            <strong className="text-slate-500 font-semibold text-right">Added On:</strong>
            <span className="text-slate-800 font-medium">{new Date(customer.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Financial Summary Card */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl shadow-lg">
          <h2 className="text-lg font-semibold text-slate-700 mb-3 border-b pb-2">Financial Summary</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-slate-500">Total Value of Orders</p>
              <p className="text-xl font-semibold text-slate-800">₹{totalOrderValue.toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <p className="text-green-600">Total Amount Paid</p>
              <p className="text-xl font-semibold text-green-700">₹{totalAmountPaidByCustomer.toLocaleString('en-IN')}</p>
            </div>
            <div className={`${overallOutstandingBalance > 0 ? 'bg-red-50' : 'bg-blue-50'} p-3 rounded-lg`}>
              <p className={`${overallOutstandingBalance > 0 ? 'text-red-600' : 'text-blue-600'}`}>Outstanding Balance</p>
              <p className={`text-xl font-semibold ${overallOutstandingBalance > 0 ? 'text-red-700' : 'text-blue-700'}`}>
                ₹{overallOutstandingBalance.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Order History Table */}
      <div className="bg-white shadow-lg rounded-xl overflow-hidden">
        <h2 className="text-lg font-semibold text-slate-700 p-5 border-b">Order History</h2>
        <div className="overflow-x-auto">
          {customerOrders.length === 0 ? (
            <p className="p-5 text-slate-500">No orders found for this customer.</p>
          ) : (
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Order #</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date & Time</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Products</th>
                  <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider" title="20L Cans Returned (This Order)">C.Rtn.</th> 
                  <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider" title="Cumulative 20L Cans Balance">C.Bal.</th> 
                  <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Order Total (₹)</th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Amount Paid (₹)</th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Order Balance (₹)</th>
                  <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {customerOrders.map(order => {
                  const orderHas20LCanItem = twentyLitreCanProduct && order.items.some(item => item.productId === twentyLitreCanProduct.id); // Changed
                  let cumulativeCanBalanceForDisplay = 0; // Changed
                  if (orderHas20LCanItem || typeof order.emptyJarsReturned === 'number') { // Field name from type
                     cumulativeCanBalanceForDisplay = calculateCustomerCumulativeEmptyCanBalance(order.customerId, allOrders, productsData, order); // Changed
                  }
                  
                  return (
                    <tr key={order.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-brandBlue hover:text-brandBlue-dark">{order.orderNumber}</div>
                          {order.place && <div className="text-xs text-slate-500">{order.place}</div>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                        {new Date(order.orderDate).toLocaleDateString('en-GB')}
                        <div className="text-xs text-slate-400">
                          {new Date(order.orderDate).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-normal max-w-xs text-sm text-slate-600" title={getOrderDisplayProducts(order.items)}>{getOrderDisplayProducts(order.items)}</td>
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
                        {order.totalAmount.toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-green-600 font-semibold text-right">
                        {order.amountPaid.toLocaleString('en-IN')}
                      </td>
                      <td className={`px-4 py-3 whitespace-nowrap text-sm font-semibold text-right ${order.balanceAmount > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                        {order.balanceAmount.toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full text-white ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-medium">
                        <div>
                          <button
                            onClick={() => onEditOrder(order)}
                            className="text-brandSky hover:text-brandSky-dark p-1 rounded-md hover:bg-brandSky/10 transition-colors"
                            aria-label={`Edit order ${order.orderNumber}`}
                          >
                            {ICONS.edit('w-4 h-4')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerLedgerPage;
