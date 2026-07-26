<p align="center">
  <img src="favicon.svg" width="120" alt="HexLab logo" />
</p>
<h1 align="center">HexLab</h1>
<p align="center">
  A Network / Device Visualizer<br>
  Inspired by Homelab Hub and technical diagrams, now made for creating the diagrams<br>
  Yes this was vibecoded, I am still learning Javascript and that includes reactjs/vite
</p>

<br>


## Features

* Drag-and-drop canvas for laying out devices, applications, and links
* Custom node types and icons
* Views to toggle between network and hardware layers without duplicating diagrams
* Compose / Pod YAML import and manifest generation
* Live telemetry polling for nodes with a configured endpoint
* Multiple projects, each with its own saved diagram
* Hiding Information for exports, streams, or recordings
* Linking of nodes for special cases

## Getting Started
### GitHub Container Registry (Recommended):
Dependencies:
* Docker
```bash
docker run -d --name hexlab -p 5173:5173 -p 4173:4173 ghcr.io/oxidized-elias/hexlab:latest
```
If running the application with a domain:
```bash
docker run -d --name hexlab -e ALLOWED_HOSTS=[YOUR DOMAIN HERE] -p 5173:5173 -p 4173:4173 ghcr.io/oxidized-elias/hexlab:latest
```

### Dockerfile:
Dependencies:
* Docker
* git
```bash
git clone https://github.com/oxidized-elias/hexlab/ && cd hexlab # Clone Repository
docker build -t oxidized-elias/hexlab_git:latest .  # Build Image
docker run -d -p 5173:5173 --name hexlab oxidized-elias/hexlab_git:latest
```

### Manual Install:
Dependencies:
* Node.js
* npm
```bash
git clone https://github.com/oxidized-elias/hexlab/ && cd hexlab # Clone Repository
npm install    # Installs dependencies 
npm run dev    # Starts the Front end
npm run server # Starts the Server Storage
```

Other scripts:

| Command | Description |
| --- | --- |
| `npm run dev` | Frontend & Server Start|
| `npm run server` | Storage server Start |
| `npm run dev:vite-only` | Frontend Server Start |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run oxlint |


# FAQ
## Data Storage
Data is stored under UserData in the app's root. UserData is git-ignored so note that in the case you are backing up. The application will also back it up to the user's cookies every once in a while. You can also export data from the project

## Application Security?
That's the neat part, there is none. Application security is expected to be managed by the user in its entirely. You can use something like Cloudflare Zero Trust to handle that.
<br>

## Credits
* [RaidOwl](https://github.com/RaidOwl) for creating Homelab-Hub
* [oxidized-elias](https://github.com/oxidized-elias) for creating HexLab _idea_
* [vecteezy icons](https://www.vecteezy.com/vector-art/40259338-honey-comb-icon-vector-design-template) for the icon
* [Claude Sonnet 5](claude.ai) "Lead" Programmer
