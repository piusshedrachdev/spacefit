import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { placeOrder } from '@/api/orders';
import { ProductImage, SummaryRow } from '@/components/commerce';
import { useAuth } from '@/context/AuthProvider';
import { useCart } from '@/context/CartProvider';
import { useSettings } from '@/context/SettingsProvider';
import { useToast } from '@/context/ToastProvider';
import { ApiError } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { routes } from '@/lib/routes';
import { Button, Input, Select, Textarea } from '@/ui';
import type { PaymentMethod } from '@/types/api';

/**
 * Checkout — port of legacy checkout.html + js/checkout.js. Guest checkout
 * stays allowed (permissions.can.checkout); signed-in visitors get their
 * customer fields prefilled from the profile.
 */

const FALLBACK_CITIES = ['Lagos', 'Abuja', 'Ibadan'];

const STATES = [
  { value: 'Lagos', label: 'Lagos' },
  { value: 'FCT', label: 'Federal Capital Territory' },
  { value: 'Oyo', label: 'Oyo' }
];

const PAYMENT_LABELS: Record<string, string> = {
  card: 'Card (Visa, Mastercard)',
  transfer: 'Bank Transfer',
  cash: 'Cash on Delivery'
};

export function CheckoutPage() {
  const { cart, ensure, clearLocal } = useCart();
  const { isAuthenticated, profile, user, status } = useAuth();
  const { config } = useSettings();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    city: FALLBACK_CITIES[0],
    state: 'Lagos',
    instructions: ''
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [placing, setPlacing] = useState(false);
  const [ready, setReady] = useState(false);

  // Prefill customer details for signed-in visitors; guests start blank.
  useEffect(() => {
    if (status !== 'ready' || !isAuthenticated) return;
    setForm((current) => ({
      ...current,
      fullName: current.fullName || profile?.full_name || '',
      email: current.email || user?.email || '',
      phone: current.phone || profile?.phone || ''
    }));
  }, [status, isAuthenticated, profile, user]);

  // Legacy checkout.js called ensureCart() during init.
  useEffect(() => {
    void ensure()
      .catch(() => {
        /* empty cart / offline — the empty guard below handles it */
      })
      .finally(() => setReady(true));
  }, [ensure]);

  const symbol = config?.currencySymbol;
  const money = (amount?: number | null) => formatPrice(amount, symbol);
  const cities = config?.serviceableCities?.length ? config.serviceableCities : FALLBACK_CITIES;
  const paymentMethods = (config?.paymentMethods ?? [{ id: 'card', label: 'Card' }]).map(
    (method) => ({ id: method.id, label: PAYMENT_LABELS[method.id] ?? method.label ?? method.id })
  );

  const patch = (key: keyof typeof form) =>
    (event: { target: { value: string } }) =>
      setForm((current) => ({ ...current, [key]: event.target.value }));

  const onPlace = async () => {
    if (!cart || cart.items.length === 0) {
      toast('Your cart is empty.', true);
      return;
    }
    setPlacing(true);
    try {
      const order = await placeOrder({
        cartId: cart.id,
        customer: {
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim()
        },
        delivery: {
          address: form.address.trim(),
          city: form.city,
          state: form.state,
          instructions: form.instructions.trim()
        },
        paymentMethod
      });
      clearLocal();
      navigate(routes.orderSuccess(order.id));
    } catch (err) {
      const error = err as ApiError;
      let message = error.message;
      if (error.details && typeof error.details === 'object') {
        message += ' — ' + Object.entries(error.details as Record<string, unknown>)
          .map(([key, value]) => `${key}: ${String(value)}`)
          .join(', ');
      }
      toast(`Could not place order: ${message}`, true);
      setPlacing(false);
    }
  };

  const items = cart?.items ?? [];
  const deliveryValue = cart && cart.delivery === 0 ? 'Free' : money(cart?.delivery ?? 0);

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-8">
      <h1 className="font-headline-lg text-headline-lg sm:text-[32px] font-bold tracking-tight text-on-surface mb-6">
        Checkout
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: customer + delivery details */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <section className="bg-surface rounded-xl border border-outline-variant/90 shadow-sm p-5 sm:p-6">
            <h2 className="font-headline-sm text-headline-sm text-on-surface mb-4 flex items-center">
              1. Customer Information
            </h2>
            <div className="space-y-4">
              <Input
                label="Full name"
                name="fullName"
                autoComplete="name"
                required
                value={form.fullName}
                onChange={patch('fullName')}
              />
              <Input
                label="Email address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={patch('email')}
              />
              <Input
                label="Phone number"
                name="phone"
                type="tel"
                autoComplete="tel"
                required
                value={form.phone}
                onChange={patch('phone')}
              />
            </div>
          </section>

          <section className="bg-surface rounded-xl border border-outline-variant/90 shadow-sm p-5 sm:p-6">
            <h2 className="font-headline-sm text-headline-sm text-on-surface mb-4 flex items-center">
              2. Delivery Information
            </h2>
            <div className="space-y-4">
              <Input
                label="Address"
                name="address"
                autoComplete="street-address"
                required
                value={form.address}
                onChange={patch('address')}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select label="City" name="city" value={form.city} onChange={patch('city')}>
                  {cities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </Select>
                <Select label="State" name="state" value={form.state} onChange={patch('state')}>
                  {STATES.map((state) => (
                    <option key={state.value} value={state.value}>
                      {state.label}
                    </option>
                  ))}
                </Select>
              </div>
              <Textarea
                label="Delivery instructions (optional)"
                name="instructions"
                rows={3}
                placeholder="E.g. Ring the bell"
                value={form.instructions}
                onChange={patch('instructions')}
              />
            </div>
          </section>
        </div>

        {/* Right: summary + payment */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <section className="bg-surface rounded-xl border border-outline-variant/90 shadow-sm p-5 sm:p-6">
            <h2 className="font-headline-sm text-headline-sm text-on-surface mb-5">
              Order Summary
            </h2>
            <div className="divide-y divide-outline-variant/50 mb-5">
              {items.length === 0 ? (
                <p className="py-3.5 text-sm text-on-surface-variant">Your cart is empty.</p>
              ) : (
                items.map((item) => (
                  <div
                    key={item.key}
                    className="py-3.5 first:pt-0 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ProductImage
                        src={item.image}
                        alt={item.name}
                        className="w-16 h-16 rounded-lg object-cover border border-outline-variant flex-shrink-0"
                        fallbackClassName="w-16 h-16 rounded-lg border border-outline-variant flex items-center justify-center text-2xl flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-on-surface truncate">
                          {item.name}
                        </h3>
                        <p className="text-xs text-on-surface-variant mt-0.5">
                          Qty: {item.quantity}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="font-price-md text-price-md text-on-surface">
                        {money(item.price * item.quantity)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="space-y-2 pt-4 border-t border-outline-variant/70 text-sm">
              <SummaryRow
                className=""
                label="Subtotal"
                value={money(cart?.subtotal ?? 0)}
                labelClassName="text-on-surface-variant"
                valueClassName="font-medium text-on-surface"
              />
              <SummaryRow
                label="Delivery"
                value={deliveryValue}
                labelClassName="text-on-surface-variant"
                valueClassName="font-medium text-on-surface"
              />
              <div className="flex justify-between items-center pt-2 text-base font-bold text-on-surface">
                <span>Total</span>
                <span className="font-price-lg text-price-lg text-primary">
                  {money(cart?.total ?? 0)}
                </span>
              </div>
            </div>
          </section>

          <section className="bg-surface rounded-xl border border-outline-variant/90 shadow-sm p-5 sm:p-6">
            <h2 className="font-headline-sm text-headline-sm text-on-surface mb-4">
              Payment Method
            </h2>
            <div className="space-y-2.5" role="radiogroup" aria-label="Payment Method">
              {paymentMethods.map((method) => {
                const selected = paymentMethod === method.id;
                return (
                  <label
                    key={method.id}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg cursor-pointer transition ${
                      selected
                        ? 'border border-primary/60 bg-primary-fixed/20'
                        : 'border border-outline-variant hover:border-outline'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        className="h-4 w-4 text-primary focus:ring-primary border-outline-variant"
                        type="radio"
                        name="payment_method"
                        value={method.id}
                        checked={selected}
                        onChange={() => setPaymentMethod(method.id as PaymentMethod)}
                      />
                      <span
                        className={`text-sm font-medium ${selected ? 'text-on-surface' : 'text-on-surface-variant'}`}
                      >
                        {method.label}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="mt-6">
              <Button
                block
                data-purpose="place-order-button"
                className="py-3 text-sm"
                disabled={placing || !ready}
                onClick={() => void onPlace()}
              >
                {placing ? 'Placing order...' : 'Place Order'}
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
