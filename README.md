# custom-widget-documentation

Staffbase-Custom-Widget. Entwickelt, gebaut und released wird es aus dem
Meta-Repo [`ps-mhp/man-staffbase-cms-extensions`](https://github.com/ps-mhp/man-staffbase-cms-extensions);
dieses Repo enthält nur Quellcode und das ausgelieferte Bundle unter `dist/`.

```bash
scripts/sync.sh custom-widget-documentation
npm run build -- --env widget=custom-widget-documentation
npm test -- src/widgets/custom-widget-documentation
scripts/release.sh custom-widget-documentation
```
