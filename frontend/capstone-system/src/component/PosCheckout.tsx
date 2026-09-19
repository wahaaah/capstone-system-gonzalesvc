import { useState, useEffect } from 'react';
import { posService, type CartItem } from '../services/posService';
import { appointmentService, type Appointment } from '../services/appointmentService';
import { patientService, type Patient } from '../services/patientService';
import { frameService } from '../services/frameService';
import { ShoppingCart, Plus, Minus, Trash2, Search, X, Glasses } from 'lucide-react';

interface CatalogItem {
  cart_key: string;
  raw_id: number;
  name: string;
  category: string;
  price: number;
  stock_quantity: number;
  item_type: 'product' | 'frame';
  image_url?: string | null;
}

const SERVER_HOST = 'https://gonzalesvisionclinic.onrender.com';

const formatImageUrl = (url?: string | null): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
    return url;
  }
  return `${SERVER_HOST}${url.startsWith('/') ? '' : '/'}${url}`;
};

export default function PosCheckout() {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('guest');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Search and dropdown state for customer selection
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);

  useEffect(() => {
    loadCatalog();
    loadAppointmentsAndPatients();
  }, []);

  const loadCatalog = async () => {
    try {
      const [products, frames] = await Promise.all([
        posService.getProducts(),
        frameService.getAll(),
      ]);

      const productItems: CatalogItem[] = products.map((p: any) => ({
        cart_key: `product-${p.id}`,
        raw_id: p.id,
        name: p.name,
        category: p.category || 'Medical Product',
        price: Number(p.price),
        stock_quantity: p.stock_quantity,
        item_type: 'product',
        image_url: p.image_url || p.image || null,
      }));

      const frameItems: CatalogItem[] = frames.map((f: any) => ({
        cart_key: `frame-${f.frame_id}`,
        raw_id: f.frame_id,
        name: f.brand ? `${f.brand} - ${f.name}` : f.name,
        category: f.category || 'Frame',
        price: Number(f.price),
        stock_quantity: f.stock_quantity,
        item_type: 'frame',
        image_url: f.image_2d_url || f.image_url || null,
      }));

      setCatalog([...frameItems, ...productItems]);
    } catch (err) {
      setErrorMessage('Failed to load item catalog.');
    }
  };

  const loadAppointmentsAndPatients = async () => {
    try {
      const [appointmentData, patientData] = await Promise.all([
        appointmentService.getAll(),
        patientService.getAll(),
      ]);
      setAppointments(appointmentData);
      setPatients(patientData);
    } catch (err) {
      setErrorMessage('Failed to load customer profiles.');
    }
  };

  const addToCart = (item: CatalogItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.cart_key === item.cart_key);
      if (existing) {
        return prev.map((c) =>
          c.cart_key === item.cart_key ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [
        ...prev,
        {
          cart_key: item.cart_key,
          product_id: item.item_type === 'product' ? item.raw_id : null,
          frame_id: item.item_type === 'frame' ? item.raw_id : null,
          name: item.name,
          unit_price: item.price,
          quantity: 1,
          item_type: item.item_type,
        },
      ];
    });
  };

  const updateQuantity = (cartKey: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.cart_key === cartKey ? { ...item, quantity: item.quantity + delta } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (cartKey: string) => {
    setCart((prev) => prev.filter((item) => item.cart_key !== cartKey));
  };

  const total = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

  const handleCheckout = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    if (cart.length === 0) {
      setErrorMessage('Cart is empty. Add at least one item.');
      return;
    }

    setIsProcessing(true);
    try {
      let appointmentParam: number | null = null;
      let patientParam: string | null = null;

      if (selectedCustomer.startsWith('appointment:')) {
        const id = Number(selectedCustomer.split(':')[1]);
        if (!isNaN(id)) appointmentParam = id;
      } else if (selectedCustomer.startsWith('patient:')) {
        const idStr = selectedCustomer.split(':')[1];
        if (idStr) patientParam = idStr;
      }

      const result = await posService.checkout(appointmentParam, patientParam, cart);

      setSuccessMessage(
        `Transaction #${result.transactionId} recorded — total ₱${result.totalAmount.toFixed(2)}.`
      );
      setCart([]);
      setSelectedCustomer('guest');
      setCustomerSearchQuery('');
      loadCatalog();
    } catch (err: any) {
      setErrorMessage(err.message || 'Checkout failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const validAppointments = appointments
    .filter((appt) => {
      const status = appt.appointment_status;
      return status !== 'Canceled' && status !== 'Cancelled';
    })
    .sort((a, b) => {
      const nameA = (a.patient_name || `Patient #${a.patient_id}`).toLowerCase();
      const nameB = (b.patient_name || `Patient #${b.patient_id}`).toLowerCase();
      return nameA.localeCompare(nameB);
    });

  const sortedPatients = [...patients].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '')
  );

  const query = customerSearchQuery.toLowerCase().trim();

  const filteredPatients = sortedPatients.filter((patient) =>
    (patient.name || '').toLowerCase().includes(query)
  );

  const filteredAppointments = validAppointments.filter((appt) => {
    const displayName = (appt.patient_name || `Patient #${appt.patient_id}`).toLowerCase();
    const apptIdStr = String(appt.appointment_id);
    const dateStr = (appt.appointment_date || '').toLowerCase();
    return displayName.includes(query) || apptIdStr.includes(query) || dateStr.includes(query);
  });

  const getSelectedCustomerLabel = () => {
    if (selectedCustomer === 'guest') return '🛒 Walk-in / Guest Customer (No Appointment)';
    if (selectedCustomer.startsWith('patient:')) {
      const idStr = selectedCustomer.split(':')[1];
      const found = patients.find((p) => String(p.patient_id) === idStr);
      return found ? `👤 ${found.name} (Direct Purchase)` : 'Selected Patient';
    }
    if (selectedCustomer.startsWith('appointment:')) {
      const idStr = selectedCustomer.split(':')[1];
      const found = appointments.find((a) => String(a.appointment_id) === idStr);
      if (!found) return 'Selected Appointment';
      const displayName = found.patient_name || `Patient #${found.patient_id}`;
      return `📅 Appt #${found.appointment_id} — ${displayName} (${found.appointment_date})`;
    }
    return 'Select Customer / Appointment';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Product & Frame Catalog</h3>
        {catalog.length === 0 ? (
          <p className="text-sm text-slate-400">No items available in catalog.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {catalog.map((item) => (
              <button
                key={item.cart_key}
                onClick={() => addToCart(item)}
                disabled={item.stock_quantity <= 0}
                className="text-left rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden flex flex-col bg-white"
              >
                {/* Image Thumbnail Area */}
                <div className="h-28 bg-slate-100 relative flex items-center justify-center overflow-hidden border-b border-slate-100">
                  {item.image_url ? (
                    <img
                      src={formatImageUrl(item.image_url)}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <Glasses size={20} className="text-slate-300" />
                  )}
                  <span
                    className={`absolute top-2 right-2 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shadow-sm ${
                      item.item_type === 'frame'
                        ? 'bg-purple-600 text-white'
                        : 'bg-blue-600 text-white'
                    }`}
                  >
                    {item.item_type}
                  </span>
                </div>

                {/* Details Area */}
                <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-800 line-clamp-1">{item.name}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{item.category}</p>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-50">
                    <p className="text-xs font-bold text-blue-600">
                      ₱{item.price.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      Stock: {item.stock_quantity}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <ShoppingCart size={16} /> Cart
        </h3>

        <label className="text-xs font-medium text-slate-500 mb-1 block">Customer / Appointment</label>
        
        <div className="relative mb-4">
          <div
            onClick={() => setIsCustomerDropdownOpen(true)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white cursor-pointer flex items-center justify-between text-slate-700"
          >
            <span className="truncate">{getSelectedCustomerLabel()}</span>
            <Search size={14} className="text-slate-400 shrink-0 ml-2" />
          </div>

          {isCustomerDropdownOpen && (
            <div className="absolute top-0 left-0 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-50 flex flex-col max-h-80">
              <div className="p-2 border-b border-slate-100 flex items-center gap-2">
                <Search size={14} className="text-slate-400 shrink-0" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Search patient or appointment..."
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  className="w-full text-sm outline-none bg-transparent"
                />
                {customerSearchQuery && (
                  <button onClick={() => setCustomerSearchQuery('')} className="text-slate-400 hover:text-slate-600">
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="overflow-y-auto flex-1 p-1">
                <div
                  onClick={() => {
                    setSelectedCustomer('guest');
                    setCustomerSearchQuery('');
                    setIsCustomerDropdownOpen(false);
                  }}
                  className="px-3 py-2 text-sm hover:bg-slate-50 rounded cursor-pointer text-slate-700"
                >
                  🛒 Walk-in / Guest Customer (No Appointment)
                </div>

                {filteredPatients.length > 0 && (
                  <div className="mt-1">
                    <p className="px-3 py-1 text-[10px] font-bold uppercase text-slate-400 tracking-wider">Direct Existing Patients</p>
                    {filteredPatients.map((patient: any) => {
                      const patientId = patient.patient_id ?? patient.id;
                      return (
                        <div
                          key={`patient-${patientId}`}
                          onClick={() => {
                            setSelectedCustomer(`patient:${patientId}`);
                            setCustomerSearchQuery('');
                            setIsCustomerDropdownOpen(false);
                          }}
                          className="px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-600 rounded cursor-pointer text-slate-700"
                        >
                          👤 {patient.name} (Direct Purchase)
                        </div>
                      );
                    })}
                  </div>
                )}

                {filteredAppointments.length > 0 && (
                  <div className="mt-1">
                    <p className="px-3 py-1 text-[10px] font-bold uppercase text-slate-400 tracking-wider">Scheduled Appointments</p>
                    {filteredAppointments.map((appt) => {
                      const displayName = appt.patient_name || `Patient #${appt.patient_id}`;
                      return (
                        <div
                          key={`appt-${appt.appointment_id}`}
                          onClick={() => {
                            setSelectedCustomer(`appointment:${appt.appointment_id}`);
                            setCustomerSearchQuery('');
                            setIsCustomerDropdownOpen(false);
                          }}
                          className="px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-600 rounded cursor-pointer text-slate-700"
                        >
                          📅 Appt #{appt.appointment_id} — {displayName} ({appt.appointment_date})
                        </div>
                      );
                    })}
                  </div>
                )}

                {filteredPatients.length === 0 && filteredAppointments.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4">No matching records found.</p>
                )}
              </div>

              <div className="p-2 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setIsCustomerDropdownOpen(false)}
                  className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 space-y-2 mb-4 overflow-y-auto max-h-72">
          {cart.length === 0 ? (
            <p className="text-sm text-slate-400">No items in cart yet.</p>
          ) : (
            cart.map((item) => (
              <div
                key={item.cart_key}
                className="flex items-center justify-between text-sm border-b border-slate-100 pb-2"
              >
                <div>
                  <p className="font-medium text-slate-700">{item.name}</p>
                  <p className="text-xs text-slate-400">
                    ₱{item.unit_price.toFixed(2)} × {item.quantity}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateQuantity(item.cart_key, -1)}
                    className="p-1 rounded hover:bg-slate-100"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-5 text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.cart_key, 1)}
                    className="p-1 rounded hover:bg-slate-100"
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    onClick={() => removeFromCart(item.cart_key)}
                    className="p-1 rounded hover:bg-red-50 text-red-500 ml-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between text-sm font-semibold border-t border-slate-200 pt-3 mb-3">
          <span>Total</span>
          <span>₱{total.toFixed(2)}</span>
        </div>

        {errorMessage && <p className="text-xs text-red-500 mb-2">{errorMessage}</p>}
        {successMessage && <p className="text-xs text-emerald-600 mb-2">{successMessage}</p>}

        <button
          onClick={handleCheckout}
          disabled={isProcessing}
          className="w-full bg-blue-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {isProcessing ? 'Processing...' : 'Checkout'}
        </button>
      </div>
    </div>
  );
}