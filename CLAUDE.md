# Conftimer

Timer pour conférenciers, déployé sur Railway. Deux pages synchronisées en temps réel via WebSocket.

## URLs de production

- **Télécommande (iPhone)** : `https://conftimer-production.up.railway.app/control`
- **Affichage (iPad)** : `https://conftimer-production.up.railway.app/display`

Railway redéploie automatiquement à chaque push sur `main`.

## Structure du projet

```
server.js           Serveur Node.js + WebSocket (état du timer)
package.json        Dépendances : express + ws
public/
  control.html      Télécommande iPhone
  display.html      Grand affichage iPad (plein écran)
  manifest.json     PWA manifest (pour "Ajouter à l'écran d'accueil")
```

## Architecture

- **Serveur** (`server.js`) : source de vérité unique. Maintient l'état (`mode`, `duration`, `elapsed`, `status`) et le broadcast à tous les clients WebSocket à chaque changement.
- **Clients** : reçoivent l'état complet à chaque tick (1s) et à chaque action. Pas de logique de timer côté client — tout vient du serveur.

## Fonctionnement du timer (server.js)

### État

```js
state = { mode, duration, elapsed, status }
// mode    : 'stopwatch' | 'countdown'
// status  : 'idle' | 'running' | 'paused' | 'finished'
// elapsed : secondes écoulées depuis le démarrage
// duration: durée cible en secondes (mode countdown uniquement)
```

### Messages WebSocket (client → serveur)

| type | effet |
|------|-------|
| `setMode` | Change le mode (seulement si idle) |
| `setDuration` | Change la durée cible (seulement si idle) |
| `start` | Démarre le ticker |
| `pause` | Stoppe le ticker |
| `reset` | Remet elapsed=0, status=idle |
| `adjustDuration` | Ajuste `duration` de `delta` secondes **sans pause** (fonctionne en running/paused/finished) |

### Logique overtime (compte à rebours)

Quand `elapsed === duration` → `status = 'finished'`, **mais le ticker continue**. `elapsed` continue à monter au-delà de `duration`. L'overtime = `elapsed - duration`.

Si `adjustDuration` est utilisé en overtime pour rajouter du temps et que `elapsed < duration` à nouveau → `status` repasse à `'running'` automatiquement.

## control.html (télécommande iPhone)

### Comportement selon l'orientation

- **Portrait** : interface de contrôle complète (mode, durée, start/pause/reset, ajustement)
- **Paysage** : affichage plein écran grand format (identique à display.html), aucun contrôle

Le switch portrait/paysage est géré uniquement par CSS (`@media (orientation: landscape)`).

### Interface portrait

1. Sélecteur de mode (Chrono / Rebours)
2. Affichage du temps en cours (mini)
3. **Boutons d'ajustement** `−5min` `−1min` `+1min` `+5min` — visibles uniquement en mode rebours et hors idle (permet d'ajuster sans pause)
4. **Carte durée** (presets + spinner minutes/secondes) — visible uniquement en mode rebours + idle
5. Bouton Start / Pause / Reprendre / Réinitialiser

### PWA

Le fichier `manifest.json` + la meta `apple-mobile-web-app-capable` permettent d'ajouter la page à l'écran d'accueil iOS (Safari → Partager → Sur l'écran d'accueil). L'app s'ouvre alors en plein écran sans interface navigateur.

## display.html (grand affichage iPad)

- Chiffres `font-weight: 300`, taille responsive `clamp(80px, 26vw, 340px)`
- **Chronomètre** : chiffres blancs, compte à la hausse
- **Compte à rebours normal** : chiffres blancs
- **Dernière minute (≤ 60s)** : chiffres blancs + clignotement 1s
- **Overtime** : chiffres négatifs en rouge, encadrés d'un rectangle rouge, label « DÉPASSEMENT » à la place de « Compte à rebours »

La même logique s'applique à la vue paysage de `control.html`.

## Développement local

```bash
npm install
node server.js
# → http://localhost:3000
```

## Notes importantes

- Ne jamais stopper le ticker dans `tick()` quand le countdown arrive à 0 — l'overtime en dépend.
- `setDuration` ne fonctionne qu'en `idle`. Pour ajuster en live, utiliser `adjustDuration`.
- La branche de travail Claude est `claude/conf-repo-continuation-vK0yv`. Toujours merger vers `main` pour déclencher Railway.
