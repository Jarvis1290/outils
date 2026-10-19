# Outils d'atelier

Petites apps (PWA) d'Adi, publiées avec GitHub Pages :
**https://adi1290-vsx.github.io/outils/**

| App | Dossier | Adresse |
|---|---|---|
| Planning Horaire | `planning-horaire/` | https://adi1290-vsx.github.io/outils/planning-horaire/ |
| Porte-outils CNC | `porte-outils/` | https://adi1290-vsx.github.io/outils/porte-outils/ |
| Suivi Véhicules | `suivi-vehicules/` | https://adi1290-vsx.github.io/outils/suivi-vehicules/ |
| Calcul Atelier | `calcul-atelier/` | https://adi1290-vsx.github.io/outils/calcul-atelier/ |

## Rangement

Chaque app a son propre dossier, avec toujours les mêmes noms de fichiers :

```
nom-de-l-app/
├─ index.html            l'app (un seul fichier)
├─ manifest.json         nom, couleurs, icônes pour l'installation
├─ sw.js                 hors ligne (service worker, propre au dossier)
├─ icon-192.png
├─ icon-512.png
└─ icon-maskable-512.png (si l'app en a une)
```

`index.html` à la racine est la page d'accueil qui liste les apps.

## Anciennes adresses (rangement du 19.10.2026)

Ces fichiers ne servent qu'à rediriger les apps déjà installées vers la nouvelle adresse.
On pourra les supprimer quand toutes les apps auront été réinstallées.

| Ancienne adresse | Nouvelle |
|---|---|
| `planning-horaire/planning-horaire.html` | `planning-horaire/` |
| `tasseaux/` | `porte-outils/` |
| `vehicules/suivi-vehicules.html` | `suivi-vehicules/` |

Les données ne bougent pas : elles restent sur le téléphone (même site github.io).
