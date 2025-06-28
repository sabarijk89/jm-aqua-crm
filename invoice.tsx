
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom'; // Added useNavigate
import './invoice.css'; 
import { Product as ProductType } from './types';

interface InvoiceItemData {
  description: string;
  hsn: string;
  qty: number;
  rate: number; // Rate is EXCLUSIVE of tax
  amount: number; // qty * rate (exclusive of tax)
}

interface PassedOrderItem { 
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    hsn: string;
}

interface InvoicePageProps {
  productsData: ProductType[];
}

const CGST_RATE = 0.09;
const SGST_RATE = 0.09;
const IGST_RATE = 0.18;
const TAMIL_NADU_GST_CODE = '33';

const InvoicePage: React.FC<InvoicePageProps> = ({ productsData }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate(); // Added useNavigate hook
  const invoicePrintAreaRef = useRef<HTMLDivElement>(null);

  const [sellerName] = useState('JM Aqua Minerals');
  const [sellerAddressLine1] = useState('No.3/83A, Nalankattalai Road,');
  const [sellerAddressLine2] = useState('Iyanthnkattalai, Alangulam');
  const [sellerGstin] = useState('33EDKPM3576E1ZF');
  const [sellerPhone] = useState('+91 XXXXX XXXXX'); 
  const [sellerEmail] = useState('contact@jmaqua.com'); 

  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [refOrderNo, setRefOrderNo] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');

  const [items, setItems] = useState<InvoiceItemData[]>([]);
  const [isPopulatedFromParams, setIsPopulatedFromParams] = useState(false); 

  const [subtotal, setSubtotal] = useState(0); 
  const [taxableValue, setTaxableValue] = useState(0); 
  const [cgst, setCgst] = useState(0);
  const [sgst, setSgst] = useState(0);
  const [igstAmount, setIgstAmount] = useState(0); // New state for IGST
  const [totalTax, setTotalTax] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0); 
  const [amountInWords, setAmountInWords] = useState('Zero Rupees Only');
  const [isTamilNaduCustomer, setIsTamilNaduCustomer] = useState(false); // New state

  const numberToWords = (num: number): string => {
    if (typeof num !== 'number' || !isFinite(num)) {
        return "Error - Invalid Number";
    }
    const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
      "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    if (num === 0) return "Zero";
    
    const inWords = (n: number): string => {
      let str = "";
      if (n >= 10000000) { str += inWords(Math.floor(n / 10000000)) + " Crore "; n %= 10000000; }
      if (n >= 100000) { str += inWords(Math.floor(n / 100000)) + " Lakh "; n %= 100000; }
      if (n >= 1000) { str += inWords(Math.floor(n / 1000)) + " Thousand "; n %= 1000; }
      if (n >= 100) { str += inWords(Math.floor(n / 100)) + " Hundred "; n %= 100; }
      if (n > 0) {
        if (str !== "" && !str.endsWith(" ")) str += " "; 
        if (n < 20) str += a[n];
        else { str += b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : ""); }
      }
      return str;
    }
    let result = inWords(Math.floor(num)); 
    const decimalPart = Math.round((num % 1) * 100); 
    if (decimalPart > 0) {
        result += " And " + inWords(decimalPart) + " Paisa";
    }
    return result.replace(/\s+/g, ' ').trim();
  };

  const calculateTotals = useCallback((currentItems: InvoiceItemData[], isTNcustomer: boolean) => {
    let currentExclusiveSubtotal = 0;
    currentItems.forEach(item => {
      const qty = Number(item.qty) || 0;
      const rateExclTax = Number(item.rate) || 0; 
      currentExclusiveSubtotal += qty * rateExclTax;
    });

    const calculatedTaxableValue = currentExclusiveSubtotal; 
    let calculatedCgst = 0;
    let calculatedSgst = 0;
    let calculatedIgst = 0;
    let currentTotalTax = 0;

    if (isTNcustomer) {
      calculatedCgst = calculatedTaxableValue * CGST_RATE;
      calculatedSgst = calculatedTaxableValue * SGST_RATE;
      currentTotalTax = calculatedCgst + calculatedSgst;
    } else {
      calculatedIgst = calculatedTaxableValue * IGST_RATE;
      currentTotalTax = calculatedIgst;
    }
    
    const calculatedGrandTotal = calculatedTaxableValue + currentTotalTax;

    setSubtotal(calculatedTaxableValue); 
    setTaxableValue(calculatedTaxableValue);
    setCgst(calculatedCgst);
    setSgst(calculatedSgst);
    setIgstAmount(calculatedIgst);
    setTotalTax(currentTotalTax);
    setGrandTotal(calculatedGrandTotal);

    if (isNaN(calculatedGrandTotal) || !isFinite(calculatedGrandTotal)) {
        setAmountInWords("Error: Invalid Amount");
    } else {
        setAmountInWords("INR " + numberToWords(calculatedGrandTotal) + " Only");
    }
  }, []); 
  
  useEffect(() => {
    document.body.classList.add('invoice-body');
    
    const gstinFromParams = searchParams.get('customerGstin') || '';
    setCustomerName(searchParams.get('customerName') || '');
    setCustomerAddress(searchParams.get('customerAddress') || '');
    setCustomerGstin(gstinFromParams);
    
    const isTN = gstinFromParams.startsWith(TAMIL_NADU_GST_CODE);
    setIsTamilNaduCustomer(isTN);

    setInvoiceDate(searchParams.get('orderDate') || new Date().toLocaleDateString('en-GB'));
    setRefOrderNo(searchParams.get('orderNumber') || '');
    setVehicleNo(localStorage.getItem('jm-editable-vehicle-no') || 'TN00XX0000'); 

    const invoiceCounterKey = "jm-last-invoice-count";
    const lastCommittedCount = parseInt(localStorage.getItem(invoiceCounterKey) || '0');
    const currentDisplayInvoiceNumber = `JM${String(lastCommittedCount + 1).padStart(5, '0')}/25-26`;
    setInvoiceNo(currentDisplayInvoiceNumber);

    const itemsParam = searchParams.get('items');
    let parsedOrderItemsFromUrl: PassedOrderItem[] = [];
    if (itemsParam) {
        try {
            parsedOrderItemsFromUrl = JSON.parse(itemsParam);
        } catch (e) {
            console.error("Error parsing items from URL:", e);
        }
    }

    let initialItems: InvoiceItemData[] = [];
    if (parsedOrderItemsFromUrl.length > 0) {
        initialItems = parsedOrderItemsFromUrl.map(orderItem => ({
            description: orderItem.productName,
            hsn: orderItem.hsn,
            qty: orderItem.quantity,
            rate: parseFloat(orderItem.unitPrice.toFixed(2)),
            amount: parseFloat((orderItem.quantity * orderItem.unitPrice).toFixed(2))
        }));
        setIsPopulatedFromParams(true); 
    } else if (productsData.length > 0) { 
        initialItems = productsData.slice(0, 1).map(p => ({ 
             description: p.name.toUpperCase(), hsn: '2201', qty: 0, rate: 0, amount: 0 
        }));
        if (initialItems.length === 0) { 
            initialItems.push({ description: 'PRODUCT NAME', hsn: '2201', qty: 0, rate: 0, amount: 0 });
        }
        setIsPopulatedFromParams(false); 
    } else {
       initialItems = [{ description: 'PRODUCT NAME', hsn: '2201', qty: 0, rate: 0, amount: 0 }];
       setIsPopulatedFromParams(false);
    }
    setItems(initialItems);
    calculateTotals(initialItems, isTN); // Initial calculation
    
     return () => {
        document.body.classList.remove('invoice-body');
      };
  }, [searchParams, productsData, calculateTotals]); 

  useEffect(() => {
    calculateTotals(items, isTamilNaduCustomer);
  }, [items, isTamilNaduCustomer, calculateTotals]);


  const handleItemChange = (index: number, field: 'qty' | 'rate', value: string) => {
    let numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) { 
      numValue = 0;
    }

    const updatedItems = items.map((item, i) => {
      if (i === index) {
        const newItem = { ...item };
        if (field === 'rate') {
          newItem.rate = parseFloat(numValue.toFixed(2)); 
        } else {
          newItem.qty = numValue; 
        }
        newItem.amount = parseFloat((newItem.qty * newItem.rate).toFixed(2));
        return newItem;
      }
      return item;
    });
    setItems(updatedItems);
  };

  const handleInvoiceNoChange = (e: React.FocusEvent<HTMLSpanElement>) => {
    const newInvoiceNoText = e.currentTarget.innerText.trim();
    setInvoiceNo(newInvoiceNoText);
  };

  const handleVehicleNoChange = (e: React.FocusEvent<HTMLSpanElement>) => {
    const newVehicleNoText = e.currentTarget.innerText.trim();
    setVehicleNo(newVehicleNoText);
    localStorage.setItem('jm-editable-vehicle-no', newVehicleNoText);
  };
  
  const downloadAndPrint = () => {
    calculateTotals(items, isTamilNaduCustomer); 

    const elementToPrint = invoicePrintAreaRef.current; 
    if (!elementToPrint) return;

    const html2pdf = (window as any).html2pdf;
    if (!html2pdf) return;

    const pdfFilename = invoiceNo.replace(/[\/\s]/g, '-') + '.pdf' || 'invoice.pdf';

    const options = {
      margin:       [0.25, 0.25, 0.25, 0.25], 
      filename:     pdfFilename,
      image:        { type: 'png', quality: 0.98 },
      html2canvas:  { 
        scale: 2, 
        scrollY: 0, 
        useCORS: true, 
        backgroundColor: '#ffffff',
        onclone: (clonedDoc: Document) => {
          clonedDoc.querySelectorAll('.qty-input, .rate-input, .invoice-editable-field').forEach(node => {
            const inputElement = node as HTMLElement; 
            const span = clonedDoc.createElement('span');
            span.className = 'pdf-input-replacement'; 
            
            let displayValue = "";
            if (inputElement.tagName === 'INPUT') {
                displayValue = (inputElement as HTMLInputElement).value;
            } else { 
                displayValue = inputElement.innerText;
            }

            if (inputElement.classList.contains('rate-input') || (inputElement.dataset.fieldType === 'rate')) {
                displayValue = (displayValue && displayValue !== "") ? parseFloat(displayValue).toFixed(2) : "0.00";
            } else if (inputElement.classList.contains('qty-input') || (inputElement.dataset.fieldType === 'qty')) {
                displayValue = (displayValue && displayValue !== "") ? parseFloat(displayValue).toString() : "0";
            } else if (inputElement.dataset.fieldType === 'text-empty-is-empty' ){
                 displayValue = displayValue || ""; 
            } else { 
                 displayValue = displayValue || (inputElement.dataset.fieldType === 'address' ? '\u00A0' : ""); 
            }
            span.textContent = displayValue;
            
            if (inputElement.dataset.fieldType === 'address') {
              span.style.whiteSpace = 'pre-wrap';
              span.style.display = 'block';
            }

            inputElement.style.display = 'none';
            inputElement.parentNode?.insertBefore(span, inputElement.nextSibling);
          });
          clonedDoc.querySelectorAll('#invoice-body-items tr').forEach(row => {
            (row as HTMLElement).style.display = ''; 
          });
        }
      },
      jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().from(elementToPrint).set(options).save()
      .then(() => { 
        const invoiceKeyCounter = "jm-last-invoice-count";
        let countToIncrement = parseInt(localStorage.getItem(invoiceKeyCounter) || '0');
        countToIncrement++;
        localStorage.setItem(invoiceKeyCounter, countToIncrement.toString());

        setTimeout(() => { try { window.print(); } catch (e) { console.error(e);}}, 1000); 
      })
      .catch((e: Error) => console.error("PDF Error:", e));
  };

  const handleGoBack = () => {
    navigate(-1); // Go back to the previous page in history
  };

  return (
    <div id="invoice-container"> 
      <div ref={invoicePrintAreaRef} id="invoice-print-area">
        <h2 className="invoice-document-main-title">Original Invoice - JM Aqua Minerals</h2>
        <div id="invoice-content-render"> 
          <header className="invoice-header">
            <div className="seller-details-container">
              <h3>{sellerName}</h3>
              <p>{sellerAddressLine1}</p>
              <p>{sellerAddressLine2}</p>
              <p>GSTIN: {sellerGstin}</p>
              <p>Phone: {sellerPhone}</p>
              <p>Email: {sellerEmail}</p>
            </div>
            <div className="invoice-title-section">
              <div className="invoice-details-grid">
                <p><span>Invoice No:</span> <strong>
                  <span 
                      className="invoice-editable-field"
                      data-field-type="text"
                      contentEditable 
                      suppressContentEditableWarning
                      onBlur={handleInvoiceNoChange}
                  >
                      {invoiceNo}
                  </span></strong></p>
                <p><span>Date:</span> <strong id="invoice-date-val">{invoiceDate}</strong></p>
                <p><span>Ref Order No:</span> <strong id="ref-order-no-val">{refOrderNo}</strong></p>
                <p><span>Vehicle No:</span> <strong>
                  <span 
                      className="invoice-editable-field"
                      data-field-type="text-empty-is-empty"
                      contentEditable 
                      suppressContentEditableWarning
                      onBlur={handleVehicleNoChange}
                  >
                      {vehicleNo}
                  </span></strong></p>
              </div>
            </div>
          </header>

          <section className="invoice-parties">
            <div>
              <h3>Bill To:</h3>
              <div className="party-details">
                <p><strong>
                  <span 
                      className="invoice-editable-field" 
                      data-field-type="text"
                      contentEditable 
                      suppressContentEditableWarning 
                      onBlur={(e) => setCustomerName(e.currentTarget.innerText)}
                  >
                      {customerName}
                  </span></strong></p>
                <p>
                  <span 
                      className="invoice-editable-field"
                      data-field-type="address"
                      contentEditable 
                      suppressContentEditableWarning
                      style={{minHeight: '36px'}} 
                      onBlur={(e) => setCustomerAddress(e.currentTarget.innerText)}
                  >
                      {customerAddress}
                  </span></p>
                <p>GSTIN: <span 
                      className="invoice-editable-field" 
                      data-field-type="text"
                      contentEditable 
                      suppressContentEditableWarning
                      onBlur={(e) => setCustomerGstin(e.currentTarget.innerText)}
                  >
                    {customerGstin}
                  </span></p>
              </div>
            </div>
          </section>
          
          <table className="items-table">
            <thead>
              <tr>
                <th className="slno-col">#</th>
                <th className="desc-col">Item Description</th>
                <th className="hsn-col">HSN/SAC</th>
                <th className="qty-col">Qty</th>
                <th className="rate-col">Rate (₹)</th> 
                <th className="amount-col">Amount (₹)</th>
              </tr>
            </thead>
            <tbody id="invoice-body-items">
              {items.map((item, index) => (
                (item.description || !isPopulatedFromParams) && ( 
                <tr key={index}>
                  <td className="slno-col">{index + 1}</td>
                  <td className="desc-col">{item.description}</td>
                  <td className="hsn-col">{item.hsn}</td>
                  <td className="qty-col">
                    <input 
                      type="number" 
                      value={(item.qty === 0 && (item.description || !isPopulatedFromParams)) ? "" : item.qty}
                      placeholder="0"
                      className="qty-input"
                      data-field-type="qty"
                      onChange={(e) => handleItemChange(index, 'qty', e.target.value)} 
                      min="0"
                    />
                  </td>
                  <td className="rate-col">
                    <input 
                      type="number" 
                      value={(item.rate === 0 && (item.description || !isPopulatedFromParams)) ? "" : item.rate.toFixed(2)}
                      placeholder="0.00"
                      step="0.01" 
                      className="rate-input"
                      data-field-type="rate"
                      onChange={(e) => handleItemChange(index, 'rate', e.target.value)} 
                      min="0"
                    />
                  </td>
                  <td className="amount-col">{item.amount.toFixed(2)}</td>
                </tr>
                )
              ))}
              {items.length < 1 && Array.from({ length: 1 - items.length }).map((_, i) => ( 
                  <tr key={`empty-${i}`} style={{visibility: isPopulatedFromParams ? 'collapse' : 'visible'}}>
                      <td className="slno-col">{items.length + i + 1}</td>
                      <td className="desc-col">
                          <span className="invoice-editable-field" data-field-type="text" contentEditable suppressContentEditableWarning></span>
                      </td>
                      <td className="hsn-col">
                          <span className="invoice-editable-field" data-field-type="text" contentEditable suppressContentEditableWarning>2201</span>
                      </td>
                      <td className="qty-col">
                          <input type="number" placeholder="0" className="qty-input" data-field-type="qty" />
                      </td>
                      <td className="rate-col">
                          <input type="number" placeholder="0.00" step="0.01" className="rate-input" data-field-type="rate" />
                      </td>
                      <td className="amount-col">0.00</td>
                  </tr>
              ))}
            </tbody>
          </table>
          
          <section className="invoice-totals-summary">
              <table>
                  <tbody>
                      <tr>
                          <td>Taxable Value:</td>
                          <td id="subtotal-val">₹ {taxableValue.toFixed(2)}</td>
                      </tr>
                      {isTamilNaduCustomer ? (
                        <>
                          <tr>
                              <td>CGST @{(CGST_RATE * 100).toFixed(0)}%:</td>
                              <td id="cgst-val">₹ {cgst.toFixed(2)}</td>
                          </tr>
                          <tr>
                              <td>SGST @{(SGST_RATE * 100).toFixed(0)}%:</td>
                              <td id="sgst-val">₹ {sgst.toFixed(2)}</td>
                          </tr>
                        </>
                      ) : (
                        <tr>
                            <td>IGST @{(IGST_RATE * 100).toFixed(0)}%:</td>
                            <td id="igst-val">₹ {igstAmount.toFixed(2)}</td>
                        </tr>
                      )}
                      <tr>
                          <td>Total Tax:</td>
                          <td id="taxtotal-val">₹ {totalTax.toFixed(2)}</td>
                      </tr>
                      <tr className="grand-total-row">
                          <td>Grand Total:</td>
                          <td id="grandtotal-val">₹ {grandTotal.toFixed(2)}</td>
                      </tr>
                  </tbody>
              </table>
          </section>
          
          <p className="amount-in-words-display"><strong>Amount in Words:</strong> <span id="amount-words-val">{amountInWords}</span></p>
          
          <footer className="invoice-footer">
              <div className="declaration">
                  <u><strong>Declaration:</strong></u><br />
                  We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
              </div>
              <div className="signatory-section">
                  For <strong>{sellerName}</strong>
                  <br /><br /><br /><br />
                  Authorised Signatory
              </div>
              <p className="computer-generated-note">
                  This is a Computer Generated Invoice.
              </p>
          </footer>
        </div>
      </div>

      <div className="invoice-print-button-container">
        <button 
          id="invoice-goback-button" 
          onClick={handleGoBack}
          aria-label="Go back to previous page"
        >
          Go Back
        </button>
        <button 
          id="invoice-print-button" 
          onClick={downloadAndPrint}
          aria-label="Download PDF and Print Invoice"
        >
          Download PDF & Print
        </button>
      </div>
    </div>
  );
};

export default InvoicePage;
