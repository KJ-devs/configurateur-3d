# Configurateur 3D de meubles

Application web en deux modules : un **Room Planner** (pièces, meubles du catalogue, vues 2D/3D) et un
**Furniture Builder** (meubles paramétriques sur mesure). Le projet avance par phases ; l'état actuel est la
**phase 5** : API CRUD, base de données, client TypeScript généré, Room Planner (pièces rectangulaires ou
tracées, redimensionnables en glissant les murs ou en saisissant les cotes, regroupées et disposées sur un plan
d'ensemble où chaque pièce ou groupe peut être masqué, portes et fenêtres, vues 2D/3D, catalogue, glisser-déposer, aimantation, cotes éditables, collisions,
sélection multiple, annuler/rétablir, sauvegarde automatique) et Furniture Builder (création d'un meuble ou
modification d'un modèle du catalogue ou d'un meuble posé : dimensions, socle, fond, finition, découpe en
colonnes et rangées, contenu des compartiments, séparations déplaçables à la souris, prix estimé, conseils).

## Prérequis

- .NET SDK 8
- Node 20+ et pnpm
- Docker Desktop (PostgreSQL, et Testcontainers pour les tests de l'API)

## Lancement

```bash
docker compose up -d                 # PostgreSQL sur localhost:5434

cd api/Configurator.Api
dotnet run                           # API sur http://localhost:5080 (Swagger : /swagger)

cd web
pnpm install
pnpm dev                             # front sur http://localhost:5173
```

Au démarrage, l'API applique les migrations et insère les données de départ (6 matériaux, 10 meubles).

## Tests

```bash
cd api && dotnet test                # xUnit, intégration sur un PostgreSQL Testcontainers (Docker requis)
cd web && pnpm test                  # Vitest
```

## Régénérer le client API

Aucun type de l'API n'est écrit à la main côté front : `web/src/api/generated/` est produit par orval à partir
de `web/openapi.json`, lui-même exporté par Swashbuckle.

```bash
cd web
pnpm api:sync        # exporte openapi.json depuis l'API puis régénère le client
pnpm api:openapi     # export OpenAPI seul
pnpm api:generate    # génération orval seule
```

## Migrations

```bash
cd api
dotnet ef migrations add <Nom> -p Configurator.Infrastructure -s Configurator.Api -o Persistence/Migrations
```

## Architecture

```
React UI ──> Zustand (commandes, undo/redo) ──> engine/ + planner/ (TS pur)
    │                 │
    │                 └─ sauvegarde auto ──> client orval ──> ASP.NET Core ──> EF Core ──> PostgreSQL
    └─ React Three Fiber (rendu seul, mm → m)                   └─ FluentValidation
```

```
docker-compose.yml
api/
  Configurator.Domain/           entités et enums, sans dépendance
  Configurator.Infrastructure/   DbContext, migrations, seed, stockage de fichiers (IFileStorage)
  Configurator.Api/              controllers, DTOs, validators, ProblemDetails, Swagger
  Configurator.Tests/            tests d'intégration xUnit
web/src/
  api/                           client généré (orval) et wrapper fetch
  features/                      composants par fonctionnalité
  lib/                           utilitaires purs (unités)
  engine/                        moteur paramétrique en TS pur (phase 5)
  planner/                       snapping, collisions, géométrie des murs en TS pur (phases 2 à 4)
```

Toutes les longueurs sont en **millimètres** dans les données ; la conversion en mètres n'a lieu qu'au rendu.

### Modèle de données

| Entité | Rôle |
|---|---|
| `Project` | Nom et code de partage unique, contient des `Room` |
| `Room` | Polygone du sol (`jsonb`, coordonnées propres à la pièce), hauteur sous plafond, épaisseur des murs, matériaux, position sur le plan d'ensemble, groupe, visibilité |
| `Opening` | Porte ou fenêtre : index du mur, décalage, largeur, hauteur, allège |
| `Material` | Couleur, épaisseurs et profondeurs disponibles, prix au m² |
| `FurnitureModel` | Entrée du catalogue, de type `Asset` (GLB) ou `Parametric` (`ParametricDefinition` en `jsonb`) |
| `FurnitureInstance` | Meuble posé dans une pièce : position, rotation, couleur ou définition personnalisée |

Le mur *i* d'une pièce est le segment entre les points *i* et *i+1* du polygone.

## Format `ParametricFurniture`

Un meuble paramétrique est un caisson découpé par un arbre récursif, sérialisé en JSON.

```ts
type Content =
  | { kind: 'empty' }
  | { kind: 'shelf'; count: number }
  | { kind: 'door' | 'glassDoor'; hinge: 'left' | 'right'; shelves?: number }   // étagères derrière la porte
  | { kind: 'doubleDoor'; shelves?: number }
  | { kind: 'flap' }                                                          // abattant
  | { kind: 'drawer'; count: number }
  | { kind: 'rail' }

type Size = { mode: 'fixed'; mm: number } | { mode: 'flex'; weight: number }

type Node =
  | { id: string; type: 'leaf'; content: Content; color?: string }           // couleur propre au compartiment
  | { id: string; type: 'split'; axis: 'x' | 'y'; sizes: Size[]; children: Node[] }

type ParametricFurniture = {
  schemaVersion: 1
  width: number; height: number; depth: number   // mm, dimensions extérieures
  panelThickness: number                         // mm
  materialId: string
  hasBack: boolean
  plinthHeight: number                           // socle, 0 = aucun
  root: Node
  color?: string                                 // couleur du meuble, sinon celle du matériau
  frontColor?: string                            // couleur de toutes les façades
  handle?: 'bar' | 'knob' | 'none'               // poignées, 'bar' par défaut
  slidingDoors?: { count: number }               // portes coulissantes sur toute la façade (2 à 4)
}
```

Les champs optionnels gardent valides les documents déjà enregistrés. Couleur d'une façade : celle du
compartiment, sinon `frontColor`, sinon la couleur du meuble.

- `root` occupe l'intérieur du caisson (dimensions extérieures moins les panneaux et le socle).
- Un `split` d'axe `x` découpe en colonnes de gauche à droite, d'axe `y` en rangées de bas en haut.
- `sizes[i]` est la taille **intérieure** de l'enfant *i*. Une séparation d'épaisseur `panelThickness`
  s'intercale entre deux enfants ; l'espace restant après les tailles fixes et les séparations est réparti
  entre les tailles `flex` au prorata de leur `weight`.
