Refactor: modular static site for NWBadges

What changed
- Replaced single long index.html with modular files:
  - index.html
  - src/styles.css
  - src/data.js
  - src/app.js
- Improves UX: floating initials on landing, refined selected member area with KPIs, earned/available rows and short descriptions.
- Suggest modal retained as a local stub.

How to apply (one commit)
Option A — GitHub web UI (quickest)
1. Open your repo on GitHub.
2. Click Add file → Create new file.
3. For each file above create the file at the exact path and paste its contents.
   - index.html
   - src/styles.css
   - src/data.js
   - src/app.js
   - README.md (replace or update)
4. At the bottom set commit message: "Refactor static site into modular files and refine selected member view"
5. Commit directly to main (or create a branch & PR if you prefer).

Option B — Local git (single commit)
1. In your local clone (or clone now):
   git clone git@github.com:jo-fegan/nwbadges.git
   cd nwbadges
2. Create files and add them:
   mkdir -p src
   (create files with your editor or run: cat > index.html <<'EOF' ... EOF)
3. Commit and push:
   git add index.html src/styles.css src/data.js src/app.js README.md
   git commit -m "Refactor static site into modular files and refine selected member view"
   git push origin main

Notes
- The page uses static seed data in src/data.js. To make dynamic, replace that file with an import from Supabase or fetch endpoints and wire up auth keys per earlier plan.
- If you want, I can create a pull request branch instead of committing to main — tell me "Create PR" and I'll prepare branch/PR content (you'll need to allow me to create it).
