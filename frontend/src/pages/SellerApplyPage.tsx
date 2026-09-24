import { useEffect, useState } from 'react';
import type { ChangeEvent, KeyboardEvent, ReactNode } from 'react';
import { RequireRole } from '@/components/Visibility';
import { SmartLink } from '@/components/SmartLink';
import { useAuth } from '@/context/AuthProvider';
import { useToast } from '@/context/ToastProvider';
import { getConfig } from '@/api/meta';
import { getCategories } from '@/api/products';
import { getMySellerContext, submitSellerApplication } from '@/api/sellers';
import { routes } from '@/lib/routes';
import { Checkbox, Input, Select, Textarea } from '@/ui';
import type {
  CategoryCount,
  SellerApplication,
  SellerApplicationPayload,
  SellerContext
} from '@/types/api';

/**
 * Seller application — port of legacy seller-apply.html + js/apply.js.
 *
 * Guest visitors are redirected to /auth?next=… by <RequireRole>; signed-in
 * visitors load config + categories + their seller context and land on one
 * of: the application form, or a status shell (active seller / pending /
 * approved / rejected — rejected offers a Reapply button that returns the
 * form prefilled from the stored application, like legacy renderForm(prefill)).
 *
 * Legacy parity notes: the city select is never prefilled (it defaults to
 * the first serviceable city) and the categories multi-select is never
 * prefilled on reapply — only the delivery-place chips come back.
 */

type View = 'loading' | 'form' | 'status';

interface FormState {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  shopName: string;
  bio: string;
  deliveryPlaces: string[];
  categories: string[];
  termsAccepted: boolean;
  disclaimersAccepted: boolean;
}

const EMPTY_FORM: FormState = {
  fullName: '',
  email: '',
  phone: '',
  city: '',
  state: '',
  shopName: '',
  bio: '',
  deliveryPlaces: [],
  categories: [],
  termsAccepted: false,
  disclaimersAccepted: false
};

const FALLBACK_CITIES = ['Lagos', 'Abuja', 'Ibadan'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Legacy inputClass() — used for the raw chip input/add button. */
const RAW_INPUT_CLASS =
  'w-full text-sm border border-outline-variant rounded-lg px-3.5 py-2.5 ' +
  'focus:border-primary focus:ring-1 focus:ring-primary bg-surface text-on-surface ' +
  'shadow-sm placeholder-outline';

/**
 * Prefill rules mirror legacy renderForm(prefill): contact fields fall back
 * to the signed-in profile, the city select and the categories multi-select
 * always start empty/default, and chips come from deliveryPlaces.
 */
function buildForm(
  prefill: SellerApplication | null | undefined,
  cities: string[],
  fullName: string,
  email: string,
  phone: string
): FormState {
  return {
    fullName: prefill?.fullName || fullName,
    email: prefill?.email || email,
    phone: prefill?.phone || phone,
    city: cities[0] ?? '',
    state: prefill?.location?.state || '',
    shopName: prefill?.shopName || '',
    bio: prefill?.bio || '',
    deliveryPlaces: prefill?.deliveryPlaces ? [...prefill.deliveryPlaces] : [],
    categories: [],
    termsAccepted: false,
    disclaimersAccepted: false
  };
}

/** Signed-out visitors get bounced to /auth; everyone else sees the page. */
export function SellerApplyPage() {
  return (
    <RequireRole roles={['customer', 'seller', 'admin']}>
      <SellerApplyView />
    </RequireRole>
  );
}

function SellerApplyView() {
  const { user, profile, role } = useAuth();
  const { toast } = useToast();

  const [view, setView] = useState<View>('loading');
  const [context, setContext] = useState<SellerContext | null>(null);
  const [cities, setCities] = useState<string[]>(FALLBACK_CITIES);
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [chipInput, setChipInput] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const profileName = profile?.full_name || '';
  const profilePhone = profile?.phone || '';
  const userEmail = user?.email || '';

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      getConfig().catch(() => null),
      getCategories().catch(() => [] as CategoryCount[]),
      getMySellerContext().catch(() => null)
    ]).then(([config, categoryList, sellerContext]) => {
      if (cancelled) return;
      const resolvedCities =
        config?.serviceableCities?.length ? config.serviceableCities : FALLBACK_CITIES;
      setCities(resolvedCities);
      setCategories(categoryList);
      setContext(sellerContext);

      const application = sellerContext?.application ?? null;
      const knownStatus =
        application?.status === 'pending' ||
        application?.status === 'approved' ||
        application?.status === 'rejected';

      if (sellerContext?.isSeller || (application && knownStatus)) {
        setView('status');
      } else {
        setForm(
          buildForm(application, resolvedCities, profileName, userEmail, profilePhone)
        );
        setView('form');
      }
    });
    return () => {
      cancelled = true;
    };
    // profile/user are fixed for the session (auth settles before this route
    // renders, guaranteed by <RequireRole>).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patch =
    (key: keyof FormState) =>
    (event: { target: { value: string } }) =>
      setForm((current) => ({ ...current, [key]: event.target.value }));

  const addChip = () => {
    const value = chipInput.trim();
    if (!value) return;
    setForm((current) =>
      current.deliveryPlaces.includes(value)
        ? current
        : { ...current, deliveryPlaces: [...current.deliveryPlaces, value] }
    );
    setChipInput('');
  };

  const removeChip = (place: string) =>
    setForm((current) => ({
      ...current,
      deliveryPlaces: current.deliveryPlaces.filter((p) => p !== place)
    }));

  const reapply = (application: SellerApplication) => {
    setForm(
      buildForm(application, cities, profileName, userEmail, profilePhone)
    );
    setFormError('');
    setView('form');
  };

  const submit = () => {
    setFormError('');
    const fullName = form.fullName.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();
    const shopName = form.shopName.trim();
    const bio = form.bio.trim();

    if (fullName.length < 2) {
      setFormError('Enter your full name.');
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setFormError('Enter a valid email address.');
      return;
    }
    if (phone.length < 7) {
      setFormError('Enter a valid phone number.');
      return;
    }
    if (shopName.length < 2) {
      setFormError('Enter your shop name.');
      return;
    }
    if (!form.termsAccepted || !form.disclaimersAccepted) {
      setFormError('Please accept the terms and disclaimers.');
      return;
    }

    setSubmitting(true);
    const payload: SellerApplicationPayload = {
      fullName,
      email,
      phone,
      shopName,
      city: form.city,
      state: form.state.trim() || form.city,
      deliveryPlaces: form.deliveryPlaces,
      categories: form.categories,
      bio: bio || undefined,
      termsAccepted: form.termsAccepted,
      disclaimersAccepted: form.disclaimersAccepted
    };
    submitSellerApplication(payload)
      .then((application) => {
        toast('Application submitted \u2014 we\u2019ll be in touch soon.');
        setContext({ isSeller: false, role, seller: null, application });
        setView('status');
      })
      .catch((err: unknown) => {
        setFormError(
          (err as Error)?.message ||
            'Could not submit your application. Please try again.'
        );
        setSubmitting(false);
      });
  };

  /* ------------------------------------------------------------- loading */

  if (view === 'loading') {
    // Material icon (not <Spinner/>) — the toast host owns role="status".
    return (
      <div className="text-center py-space-2xl text-on-surface-variant">
        <span className="material-symbols-outlined animate-spin">
          progress_activity
        </span>
      </div>
    );
  }

  /* -------------------------------------------------------------- status */

  if (view === 'status' && context) {
    const application = context.application;

    if (context.isSeller) {
      return (
        <StatusShell
          icon="verified"
          tone="text-primary"
          title={'You\u2019re a SpaceFit seller'}
          cta={
            <SmartLink
              href={routes.sellerDashboard}
              className="inline-block bg-primary text-on-primary px-space-xl py-space-md rounded-lg font-label-lg hover:opacity-95"
            >
              Open seller dashboard
            </SmartLink>
          }
        >
          <p>
            Your shop{context.seller ? <strong> {context.seller.shopName}</strong> : null}{' '}
            is active. Head to your dashboard to list products and track sales.
          </p>
        </StatusShell>
      );
    }

    if (!application) {
      // Defensive: submit success always carries an application; without one
      // legacy fell through to renderForm().
      return (
        <FormView
          cities={cities}
          categories={categories}
          form={form}
          chipInput={chipInput}
          formError={formError}
          submitting={submitting}
          onPatch={patch}
          onChipInputChange={setChipInput}
          onAddChip={addChip}
          onRemoveChip={removeChip}
          onCategoryChange={(values) =>
            setForm((current) => ({ ...current, categories: values }))
          }
          onTermsChange={(key, checked) =>
            setForm((current) => ({ ...current, [key]: checked }))
          }
          onSubmitForm={submit}
        />
      );
    }

    if (application.status === 'pending') {
      return (
        <StatusShell
          icon="hourglass_top"
          tone="text-secondary"
          title="Application under review"
          cta={
            <SmartLink
              href={routes.home}
              className="inline-block border border-outline-variant px-space-xl py-space-md rounded-lg font-label-lg hover:border-primary"
            >
              Continue shopping
            </SmartLink>
          }
        >
          <p>
            Thanks, {application.fullName}. We{'\u2019'}ve received your application
            for <strong>{application.shopName}</strong> and will review it within{' '}
            {'2\u20133'} business days.
          </p>
          <DetailRow label="Reference" value={application.id} />
          <DetailRow
            label="Delivery places"
            value={(application.deliveryPlaces || []).join(', ')}
          />
          <DetailRow label="Categories" value={(application.categories || []).join(', ')} />
        </StatusShell>
      );
    }

    if (application.status === 'approved') {
      return (
        <StatusShell
          icon="verified"
          tone="text-primary"
          title="Application approved"
          cta={
            <SmartLink
              href={routes.sellerDashboard}
              className="inline-block bg-primary text-on-primary px-space-xl py-space-md rounded-lg font-label-lg hover:opacity-95"
            >
              Open seller dashboard
            </SmartLink>
          }
        >
          <p>
            {'Congratulations \u2014 '}<strong>{application.shopName}</strong> has been
            approved. Open your seller dashboard to get started.
          </p>
        </StatusShell>
      );
    }

    if (application.status === 'rejected') {
      return (
        <StatusShell
          icon="cancel"
          tone="text-error"
          title="Application not approved"
          cta={
            <button
              type="button"
              id="reapply"
              onClick={() => reapply(application)}
              className="inline-block bg-primary text-on-primary px-space-xl py-space-md rounded-lg font-label-lg hover:opacity-95"
            >
              Reapply
            </button>
          }
        >
          <p>
            Unfortunately your application for <strong>{application.shopName}</strong>{' '}
            was not approved at this time.
          </p>
          {application.reviewNotes ? (
            <p className="bg-error-container text-on-error-container rounded-lg p-space-md">
              Reviewer note: {application.reviewNotes}
            </p>
          ) : null}
          <p>
            {'You\u2019re'} welcome to reapply once the points above have been addressed.
          </p>
        </StatusShell>
      );
    }

    // Unknown status — legacy fell through to renderForm(application).
    // Render-phase state adjustment (same-component, guarded: the next render
    // takes the 'form' branch, so this cannot loop).
    reapply(application);
    return null;
  }

  /* ----------------------------------------------------------------- form */

  return (
    <FormView
      cities={cities}
      categories={categories}
      form={form}
      chipInput={chipInput}
      formError={formError}
      submitting={submitting}
      onPatch={patch}
      onChipInputChange={setChipInput}
      onAddChip={addChip}
      onRemoveChip={removeChip}
      onCategoryChange={(values) =>
        setForm((current) => ({ ...current, categories: values }))
      }
      onTermsChange={(key, checked) =>
        setForm((current) => ({ ...current, [key]: checked }))
      }
      onSubmitForm={submit}
    />
  );
}

/* ------------------------------------------------------------ presentational */

function StatusShell({
  icon,
  tone,
  title,
  children,
  cta
}: {
  icon: string;
  tone: string;
  title: string;
  children: ReactNode;
  cta?: ReactNode;
}) {
  return (
    <div className="max-w-2xl mx-auto bg-surface rounded-2xl border border-outline-variant/60 shadow-sm p-space-2xl text-center">
      <span
        className={`material-symbols-outlined text-5xl ${tone}`}
        style={{ fontVariationSettings: "'FILL' 1" }}
      >
        {icon}
      </span>
      <h1 className="font-headline-lg text-headline-lg text-on-surface mt-space-md">
        {title}
      </h1>
      <div className="font-body-lg text-body-lg text-on-surface-variant mt-space-sm space-y-space-sm text-left sm:text-center">
        {children}
      </div>
      {cta ? <div className="mt-space-lg">{cta}</div> : null}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="font-label-md text-on-surface-variant">{label}:</span>{' '}
      {value || '\u2014'}
    </p>
  );
}

function SectionCard({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="bg-surface rounded-xl border border-outline-variant/90 shadow-sm p-5 sm:p-6">
      <h2 className="font-headline-sm text-headline-sm text-on-surface mb-4">
        {title}
      </h2>
      {children}
    </section>
  );
}

interface FormViewProps {
  cities: string[];
  categories: CategoryCount[];
  form: FormState;
  chipInput: string;
  formError: string;
  submitting: boolean;
  onPatch: (key: keyof FormState) => (event: { target: { value: string } }) => void;
  onChipInputChange: (value: string) => void;
  onAddChip: () => void;
  onRemoveChip: (place: string) => void;
  onCategoryChange: (values: string[]) => void;
  onTermsChange: (key: 'termsAccepted' | 'disclaimersAccepted', checked: boolean) => void;
  onSubmitForm: () => void;
}

function FormView(props: FormViewProps) {
  const { form, chipInput, formError, submitting } = props;

  const onChipKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      props.onAddChip();
    }
  };

  const onCategoryChange = (event: ChangeEvent<HTMLSelectElement>) => {
    props.onCategoryChange(
      Array.from(event.target.selectedOptions).map((option) => option.value)
    );
  };

  return (
    <div className="max-w-5xl w-full mx-auto px-margin pt-8 pb-space-2xl">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-space-xs">
          Apply to sell on SpaceFit
        </h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant mb-space-lg">
          Tell us about your shop. Our team reviews applications within{' '}
          {'2\u20133'} business days.
        </p>

        {formError ? (
          <p className="text-sm text-error font-body-md" id="formError">
            {formError}
          </p>
        ) : null}

        <div className="flex flex-col gap-6 mt-space-md">
          <SectionCard title="1. Contact details">
            <div className="space-y-4">
              <Input
                label="Full name"
                id="fullName"
                type="text"
                value={form.fullName}
                onChange={props.onPatch('fullName')}
              />
              <Input
                label="Email"
                id="email"
                type="email"
                value={form.email}
                onChange={props.onPatch('email')}
              />
              <Input
                label="Phone"
                id="phone"
                type="tel"
                placeholder="+234..."
                value={form.phone}
                onChange={props.onPatch('phone')}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="City"
                  id="city"
                  value={form.city}
                  onChange={props.onPatch('city')}
                >
                  {props.cities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </Select>
                <Input
                  label="State"
                  id="state"
                  type="text"
                  placeholder="e.g. Lagos"
                  value={form.state}
                  onChange={props.onPatch('state')}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="2. Your shop">
            <div className="space-y-4">
              <Input
                label="Shop name"
                id="shopName"
                type="text"
                placeholder="The name buyers will see"
                value={form.shopName}
                onChange={props.onPatch('shopName')}
              />
              <Textarea
                label="What do you sell? (optional)"
                id="bio"
                rows={3}
                placeholder="A short description of your craft and products"
                value={form.bio}
                onChange={props.onPatch('bio')}
              />
              <div>
                <span className="block text-xs font-medium text-on-surface-variant mb-1">
                  Delivery places
                </span>
                <div className="flex flex-wrap gap-2 mb-2" id="chipList">
                  {form.deliveryPlaces.map((place) => (
                    <span
                      key={place}
                      className="inline-flex items-center gap-1 px-space-sm py-space-xs rounded-full bg-surface-container-high font-label-md"
                    >
                      {place}
                      <button
                        type="button"
                        aria-label={`Remove ${place}`}
                        onClick={() => props.onRemoveChip(place)}
                        className="text-on-surface-variant hover:text-error"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    className={RAW_INPUT_CLASS}
                    id="chipInput"
                    type="text"
                    placeholder="Add a city or region"
                    value={chipInput}
                    onChange={(event) => props.onChipInputChange(event.target.value)}
                    onKeyDown={onChipKeyDown}
                  />
                  <button
                    type="button"
                    className="px-space-md rounded-lg border border-outline-variant hover:border-primary font-label-md"
                    id="chipAdd"
                    onClick={props.onAddChip}
                  >
                    Add
                  </button>
                </div>
              </div>
              <Select
                label="Intended categories"
                id="categorySelect"
                multiple
                size={4}
                value={form.categories}
                onChange={onCategoryChange}
              >
                {props.categories.map((category) => (
                  <option key={category.name} value={category.name}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </div>
          </SectionCard>

          <SectionCard title="3. Terms & disclaimers">
            <div className="space-y-4">
              <details className="border border-outline-variant/60 rounded-lg p-3">
                <summary className="cursor-pointer font-label-lg">
                  Seller terms &amp; conditions
                </summary>
                <p className="font-body-sm text-on-surface-variant mt-2">
                  By selling on SpaceFit you agree to list authentic, accurately described
                  goods, honour the 7-day return window, respond to buyer enquiries within
                  48 hours, and comply with all applicable Nigerian consumer laws. Breaches
                  may lead to suspension.
                </p>
              </details>
              <details className="border border-outline-variant/60 rounded-lg p-3">
                <summary className="cursor-pointer font-label-lg">Disclaimers</summary>
                <p className="font-body-sm text-on-surface-variant mt-2">
                  SpaceFit acts as a marketplace and is not the manufacturer or importer of
                  listed goods. Sellers are responsible for the accuracy of their listings,
                  product safety and applicable taxes.
                </p>
              </details>
              <Checkbox
                id="termsAccepted"
                checked={form.termsAccepted}
                onChange={(event) =>
                  props.onTermsChange('termsAccepted', event.target.checked)
                }
                label="I accept the seller terms & conditions."
              />
              <Checkbox
                id="disclaimersAccepted"
                checked={form.disclaimersAccepted}
                onChange={(event) =>
                  props.onTermsChange('disclaimersAccepted', event.target.checked)
                }
                label="I have read and accept the disclaimers."
              />
            </div>
          </SectionCard>
        </div>

        <div className="mt-space-lg flex justify-end">
          <button
            type="button"
            id="submitApplication"
            disabled={submitting}
            onClick={props.onSubmitForm}
            className="bg-primary text-on-primary px-space-xl py-space-md rounded-lg font-label-lg hover:opacity-95 disabled:opacity-60"
          >
            {submitting ? 'Submitting\u2026' : 'Submit application'}
          </button>
        </div>
      </div>
    </div>
  );
}
