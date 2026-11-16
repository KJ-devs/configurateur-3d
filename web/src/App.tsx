import { CatalogPanel } from './features/catalog/CatalogPanel'

const App = () => (
  <div className="mx-auto flex min-h-full max-w-5xl flex-col gap-6 px-6 py-8">
    <header>
      <h1 className="text-2xl font-semibold tracking-tight">Configurateur 3D</h1>
      <p className="text-sm text-stone-500">Catalogue de meubles</p>
    </header>
    <main>
      <CatalogPanel />
    </main>
  </div>
)

export default App
