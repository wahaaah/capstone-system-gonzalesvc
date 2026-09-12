import { useState, useEffect } from 'react';
import { posService, type CartItem } from '../services/posService';
import { appointmentService, type Appointment } from '../services/appointmentService';
import { frameService } from '../services/frameService';
import { ShoppingCart, Plus, Minus, Trash2 } from 'lucide-react';

interface CatalogItem {
  cart_key: string;
  raw_id: number;
  name: string;
  category: string;
  price: number;
  stock_quantity: number;
  item_type: 'product' | 'frame';
}

export default function PosCheckout() {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadCatalog();
    loadAppointments();
  }, []);

  const loadCatalog = async () => {
    try {
      const [products, frames] = await Promise.all([
        posService.getProducts(),
        frameService.getAll(),
      ]);

      const productItems: CatalogItem[] = products.map((p) => ({
        cart_key: `product-${p.id}`,
        raw_id: p.id,
        name: p.name,
        category: p.category || 'Medical Product',
        price: Number(p.price),
        stock_quantity: p.stock_quantity,
        item_type: 'product',
      }));

      const frameItems: CatalogItem[] = frames.map((f) => ({
        cart_key: `frame-${f.frame_id}`,
        raw_id: f.frame_id,
        name: f.brand ? `${f.brand} - ${f.name}` : f.name,
        category: f.category || 'Frame',
        price: Number(f.price),
        stock_quantity: f.stock_quantity,
        item_type: 'frame',
      }));

      setCatalog([...frameItems, ...productItems]);
    } catch (err) {
      setErrorMessage('Failed to load item catalog.');
    }
  };

  const loadAppointments = async () => {
    try {
      const data = await appointmentService.getAll();
      setAppointments(data);
    } catch (err) {
      setErrorMessage('Failed to load appointments.');
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
      const appointmentParam = selectedAppointmentId !== '' ? selectedAppointmentId : null;
      const result = await posService.checkout(appointmentParam, cart);

      setSuccessMessage(
        `Transaction #${result.transactionId} recorded — total ₱${result.totalAmount.toFixed(2)}.`
      );
      setCart([]);
      setSelectedAppointmentId('');
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Catalog */}
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
                className="text-left p-3 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed relative"
              >
                <div className="flex items-start justify-between gap-1">
                  <p className="text-sm font-medium text-slate-800 line-clamp-1">{item.name}</p>
                  <span
                    className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      item.item_type === 'frame' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {item.item_type}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{item.category}</p>
                <p className="text-sm font-semibold text-blue-600 mt-1">
                  ₱{item.price.toFixed(2)}
                </p>
                <p className="text-xs text-slate-400">Stock: {item.stock_quantity}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <ShoppingCart size={16} /> Cart
        </h3>

        <label className="text-xs font-medium text-slate-500 mb-1 block">Customer / Appointment </label>
        
        <select
          value={selectedAppointmentId}
          onChange={(e) => setSelectedAppointmentId(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4"
        >
          <option value="">🛒 Walk-in / Guest Customer (No Appointment)</option>
          {validAppointments.map((appt) => {
            const displayName = appt.patient_name || `Patient #${appt.patient_id}`;
            return (
              <option key={appt.appointment_id} value={appt.appointment_id}>
                {displayName} — Appt #{appt.appointment_id} ({appt.appointment_date})
              </option>
            );
          })}
        </select>

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