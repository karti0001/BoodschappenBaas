import { useMemo, useState } from 'react'
import { Link, Navigate, Route, Routes, useParams } from 'react-router-dom'

const MOCK_OFFERS = [
  { id: 'offer-1', productName: 'Melk', store: 'Albert Heijn', discountText: '1+1 gratis' },
  { id: 'offer-2', productName: 'Pasta', store: 'Jumbo', discountText: '2e halve prijs' },
  { id: 'offer-3', productName: 'Bananen', store: 'Lidl', discountText: '0,99 per tros' },
]

const INITIAL_ITEMS = [
  { id: 'item-1', name: 'Melk', quantity: 1, category: 'Zuivel' },
  { id: 'item-2', name: 'Pasta', quantity: 2, category: 'Droogwaren' },
  { id: 'item-3', name: 'Bananen', quantity: 6, category: 'Fruit' },
]

function App() {
  const [title, setTitle] = useState('Weekboodschappen')
  const [items, setItems] = useState(INITIAL_ITEMS)
  const [shareToken, setShareToken] = useState('')
  const [storePreference, setStorePreference] = useState(['Fruit', 'Zuivel', 'Droogwaren'])

  const offers = useMemo(() => {
    const productNames = new Set(items.map((item) => item.name.toLowerCase()))
    return MOCK_OFFERS.filter((offer) => productNames.has(offer.productName.toLowerCase()))
  }, [items])

  const addItem = (payload) => {
    setItems((current) => [
      ...current,
      {
        id: globalThis.crypto?.randomUUID?.() ?? `item-${Date.now()}`,
        name: payload.name,
        quantity: Number(payload.quantity) || 1,
        category: payload.category || 'Overig',
      },
    ])
  }

  const updateItem = (id, payload) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...payload, quantity: Number(payload.quantity) || 1 } : item)),
    )
  }

  const deleteItem = (id) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }

  const createShareLink = () => {
    const token = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`
    setShareToken(token)
    return `${window.location.origin}/shared/${token}`
  }

  const applySorting = (categories) => {
    setStorePreference(categories)
    setItems((current) => {
      const rank = new Map(categories.map((category, index) => [category.toLowerCase(), index]))
      return [...current].sort((a, b) => {
        const rankA = rank.has(a.category.toLowerCase()) ? rank.get(a.category.toLowerCase()) : Number.MAX_SAFE_INTEGER
        const rankB = rank.has(b.category.toLowerCase()) ? rank.get(b.category.toLowerCase()) : Number.MAX_SAFE_INTEGER

        if (rankA === rankB) {
          return a.name.localeCompare(b.name)
        }

        return rankA - rankB
      })
    })
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8">
      <header className="mb-8 rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold">BoodschappenBaas Prototype</h1>
        <p className="mt-2 text-slate-600">Beheer je lijst, deel met anderen, sorteer op winkelvolgorde en bekijk aanbiedingen.</p>
        <nav className="mt-4 flex flex-wrap gap-3 text-sm font-medium">
          <Link className="rounded-lg bg-slate-900 px-3 py-2 text-white" to="/">Lijst beheren</Link>
          <Link className="rounded-lg bg-slate-200 px-3 py-2 text-slate-900" to="/sort">Volgorde wijzigen</Link>
          <Link className="rounded-lg bg-slate-200 px-3 py-2 text-slate-900" to={shareToken ? `/shared/${shareToken}` : '/shared/demo'}>Gedeelde lijst</Link>
        </nav>
      </header>

      <Routes>
        <Route
          path="/"
          element={
            <ListManagementPage
              title={title}
              items={items}
              offers={offers}
              onTitleChange={setTitle}
              onAddItem={addItem}
              onUpdateItem={updateItem}
              onDeleteItem={deleteItem}
              onCreateShareLink={createShareLink}
            />
          }
        />
        <Route
          path="/sort"
          element={
            <SortPage
              storePreference={storePreference}
              items={items}
              onApplySorting={applySorting}
            />
          }
        />
        <Route
          path="/shared/:token"
          element={<SharedListPage token={shareToken} title={title} items={items} offers={offers} />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  )
}

function ListManagementPage({
  title,
  items,
  offers,
  onTitleChange,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onCreateShareLink,
}) {
  const [formData, setFormData] = useState({ name: '', quantity: 1, category: 'Overig' })
  const [shareLink, setShareLink] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!formData.name.trim()) {
      return
    }

    onAddItem(formData)
    setFormData({ name: '', quantity: 1, category: 'Overig' })
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
        <label className="block text-sm font-medium text-slate-700" htmlFor="list-title">Titel boodschappenlijst</label>
        <input
          id="list-title"
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
        />

        <form className="grid gap-3 sm:grid-cols-3" onSubmit={handleSubmit}>
          <input
            className="rounded-lg border border-slate-300 px-3 py-2"
            placeholder="Product"
            value={formData.name}
            onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
          />
          <input
            className="rounded-lg border border-slate-300 px-3 py-2"
            min="1"
            placeholder="Aantal"
            type="number"
            value={formData.quantity}
            onChange={(event) => setFormData((current) => ({ ...current, quantity: event.target.value }))}
          />
          <input
            className="rounded-lg border border-slate-300 px-3 py-2"
            placeholder="Categorie"
            value={formData.category}
            onChange={(event) => setFormData((current) => ({ ...current, category: event.target.value }))}
          />
          <button className="rounded-lg bg-emerald-600 px-3 py-2 text-white sm:col-span-3" type="submit">Product toevoegen</button>
        </form>

        <ul className="space-y-2">
          {items.map((item) => (
            <li className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[2fr_80px_2fr_auto]" key={item.id}>
              <input
                className="rounded-md border border-slate-300 px-2 py-1"
                value={item.name}
                onChange={(event) => onUpdateItem(item.id, { name: event.target.value })}
              />
              <input
                className="rounded-md border border-slate-300 px-2 py-1"
                min="1"
                type="number"
                value={item.quantity}
                onChange={(event) => onUpdateItem(item.id, { quantity: event.target.value })}
              />
              <input
                className="rounded-md border border-slate-300 px-2 py-1"
                value={item.category}
                onChange={(event) => onUpdateItem(item.id, { category: event.target.value })}
              />
              <button className="rounded-md bg-rose-500 px-3 py-1 text-white" onClick={() => onDeleteItem(item.id)} type="button">Verwijder</button>
            </li>
          ))}
        </ul>

        <div className="rounded-lg bg-slate-100 p-3">
          <button
            className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white"
            onClick={() => setShareLink(onCreateShareLink())}
            type="button"
          >
            Genereer deelbare link
          </button>
          {shareLink && <p className="mt-2 break-all text-sm text-slate-700">{shareLink}</p>}
        </div>
      </div>

      <aside className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Aanbiedingen</h2>
        <p className="mt-1 text-sm text-slate-600">Mock data gebaseerd op je lijst.</p>
        <ul className="mt-4 space-y-3">
          {offers.map((offer) => (
            <li className="rounded-lg border border-emerald-200 bg-emerald-50 p-3" key={offer.id}>
              <p className="font-medium">{offer.productName}</p>
              <p className="text-sm text-slate-600">{offer.store}</p>
              <p className="text-sm font-semibold text-emerald-700">{offer.discountText}</p>
            </li>
          ))}
          {!offers.length && <li className="text-sm text-slate-500">Geen aanbiedingen beschikbaar.</li>}
        </ul>
      </aside>
    </section>
  )
}

function SortPage({ storePreference, items, onApplySorting }) {
  const [input, setInput] = useState(storePreference.join(', '))

  const handleApply = (event) => {
    event.preventDefault()
    const categories = input
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)

    onApplySorting(categories)
  }

  return (
    <section className="space-y-6 rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-semibold">Volgorde per voorkeurswinkel</h2>
      <p className="text-sm text-slate-600">Vul categorieën in volgorde van je winkelroute in, gescheiden door komma's.</p>
      <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleApply}>
        <input
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <button className="rounded-lg bg-indigo-600 px-4 py-2 text-white" type="submit">Toepassen</button>
      </form>

      <ul className="space-y-2">
        {items.map((item, index) => (
          <li className="rounded-lg border border-slate-200 p-3" key={item.id}>
            <span className="font-semibold">{index + 1}.</span> {item.name} <span className="text-slate-500">({item.category})</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function SharedListPage({ token, title, items, offers }) {
  const params = useParams()

  if (!token || params.token !== token) {
    return (
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold">Gedeelde lijst</h2>
        <p className="mt-2 text-slate-600">Geen geldige gedeelde lijst gevonden. Genereer eerst een deelbare link.</p>
      </section>
    )
  }

  return (
    <section className="grid gap-6 rounded-2xl bg-white p-6 shadow-sm lg:grid-cols-2">
      <div>
        <h2 className="text-2xl font-semibold">{title}</h2>
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li className="rounded-lg border border-slate-200 p-3" key={item.id}>
              {item.name} - {item.quantity}x <span className="text-slate-500">({item.category})</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-lg font-semibold">Actuele aanbiedingen</h3>
        <ul className="mt-3 space-y-2">
          {offers.map((offer) => (
            <li className="rounded-lg border border-emerald-200 bg-emerald-50 p-3" key={offer.id}>
              {offer.productName} - {offer.discountText} ({offer.store})
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export default App
