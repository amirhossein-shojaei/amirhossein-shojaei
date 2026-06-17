# 📊 GitHub Statistics

<div align="center">

<table>
<tr>
<td>

<img src="https://github-readme-stats.vercel.app/api?username=YOUR_USERNAME&show_icons=true&theme=tokyonight&hide_border=true&count_private=true" />

</td>

<td>

<img src="https://github-readme-stats.vercel.app/api/top-langs/?username=YOUR_USERNAME&layout=compact&theme=tokyonight&hide_border=true" />

</td>
</tr>
</table>

</div>

---

# 🔥 GitHub Streak

<div align="center">

<img src="https://streak-stats.demolab.com?user=YOUR_USERNAME&theme=tokyonight&hide_border=true" />

</div>

---

# 📈 Contribution Activity Graph

<div align="center">

<img width="95%" src="https://github-readme-activity-graph.vercel.app/graph?username=YOUR_USERNAME&theme=tokyo-night&hide_border=true&area=true" />

</div>

---

# 🏆 GitHub Trophies

<div align="center">

<img src="https://github-profile-trophy.vercel.app/?username=YOUR_USERNAME&theme=tokyonight&no-frame=true&no-bg=true&margin-w=15&row=2&column=4" />

</div>

---

# 📋 Commit Information

<div align="center">

| Metric                 |  Status |
| :--------------------- | :-----: |
| 🚀 Total Commits       | Dynamic |
| 🔥 Current Streak      | Dynamic |
| ⭐ Total Stars          | Dynamic |
| 📦 Public Repositories | Dynamic |
| 🛠 Pull Requests       | Dynamic |
| 👥 Followers           | Dynamic |

</div>

</div>

---

# 📑 Profile Summary Cards

<div align="center">

<img width="100%" src="https://github-profile-summary-cards.vercel.app/api/cards/profile-details?username=YOUR_USERNAME&theme=tokyonight" />

<br><br>

<img src="https://github-profile-summary-cards.vercel.app/api/cards/repos-per-language?username=YOUR_USERNAME&theme=tokyonight" />

<img src="https://github-profile-summary-cards.vercel.app/api/cards/most-commit-language?username=YOUR_USERNAME&theme=tokyonight" />

<br><br>

<img src="https://github-profile-summary-cards.vercel.app/api/cards/stats?username=YOUR_USERNAME&theme=tokyonight" />

<img src="https://github-profile-summary-cards.vercel.app/api/cards/productive-time?username=YOUR_USERNAME&theme=tokyonight&utcOffset=0" />

</div>

---

# 🐍 Snake Contribution Animation

Create a file:

`.github/workflows/snake.yml`

```yml
name: Generate Snake

on:
  schedule:
    - cron: "0 */12 * * *"

  workflow_dispatch:

jobs:
  build:

    runs-on: ubuntu-latest

    steps:
      - uses: Platane/snk@v3
        with:
          github_user_name: YOUR_USERNAME
          outputs: |
            dist/github-contribution-grid-snake.svg
            dist/github-contribution-grid-snake-dark.svg?palette=github-dark

      - uses: crazy-max/ghaction-github-pages@v4
        with:
          target_branch: output
          build_dir: dist
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Then add this to README:

```md
<div align="center">

<img src="https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_USERNAME/output/github-contribution-grid-snake-dark.svg" />

</div>
```

---

# 👀 Visitor Counter

```md
<div align="center">

<img src="https://komarev.com/ghpvc/?username=YOUR_USERNAME&label=Profile%20Views&color=blueviolet&style=for-the-badge" />

</div>
```

---

# ✨ Animated Typing Header

```md
<div align="center">

<img src="https://readme-typing-svg.herokuapp.com?font=Fira+Code&weight=700&size=32&pause=1000&color=00F7FF&center=true&vCenter=true&width=700&lines=Full+Stack+Developer+🚀;React+%7C+Node.js+Developer;Building+Modern+Web+Applications;Docker+%7C+Python+%7C+TypeScript;Always+Learning+New+Things+🔥" />

</div>
```
