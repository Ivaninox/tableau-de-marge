# Flying For You — Suivi des Marges

Application web interne pour le suivi des marges opérations terrain.

## Installation (3 étapes)

### 1. Installer les dépendances
```bash
cd "/Users/Cheikhy/Desktop/Site Marge Prod"
npm install
```

### 2. Importer les données historiques (optionnel)
```bash
npm run import -- --file=./FFY_Marges_v8.xlsx
```

### 3. Lancer l'application
```bash
npm run dev
```

Ouvrir **http://localhost:3000** dans le navigateur.

---

## Fonctionnalités

- **Dashboard** — KPIs, graphiques CA mensuel, évolution des marges pluriannuelle, tableaux de synthèse
- **Saisie** — Formulaire de création/modification d'opération avec calcul de marge en temps réel
- **Filtres** — Par année, AO / Hors AO
- **Import Excel** — Script d'import des données historiques

## Calcul des marges

| Indicateur | Formule |
|---|---|
| Marge Brute | `(CA HT − Coût total) / CA HT` |
| Marge Externe | `(CA HT − Coût hors CDI) / CA HT` |

**Seuils de couleur :** 🔴 < 40 % · 🟠 40–65 % · 🟢 ≥ 65 %

## Structure de la base de données

```
data/marges.db          ← fichier SQLite (créé automatiquement)

tables :
  operations            ← une ligne par opération terrain
  lignes_couts          ← N lignes de coût par opération
  cdi_agents            ← liste des agents CDI (exlcus de la marge externe)
```

## Format Excel pour l'import

Le script détecte automatiquement les en-têtes. Colonnes attendues :

| Colonne | Contenu | Exemple |
|---|---|---|
| Code opération | Code unique | PESS0426 |
| Mois | Numéro ou nom | 4 ou Avril |
| Année | Année entière | 2026 |
| Client | Nom client | Pessac |
| AO | oui/non ou 1/0 | oui |
| Prix vente HT | Montant en € | 10000 |
| Type coût | CDI/Agent/Support/Déplacement | Agent |
| Intitulé | Prénom ou libellé | Raouf |
| Nb heures | Nombre d'heures | 35 |
| Taux horaire | € par heure | 15 |
| Coût fixe | Montant fixe | 500 |

Si vos en-têtes sont différents, modifiez `COLUMN_MAP` dans `scripts/import.ts`.

## Migration vers PostgreSQL (futur hébergement)

Remplacer `better-sqlite3` par `pg` et adapter `src/lib/db.ts`.
Les requêtes SQL sont compatibles PostgreSQL (pas de syntaxe SQLite-spécifique).
