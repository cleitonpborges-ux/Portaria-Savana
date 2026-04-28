# Portaria Savana — PWA

## 📁 Estrutura de pastas no GitHub

```
/  (raiz do repositório)
├── index.html          ← seu app (v1)
├── manifest.json       ← config do PWA
├── sw.js               ← Service Worker (cache offline)
└── icons/
    ├── icon-72.png
    ├── icon-96.png
    ├── icon-128.png
    ├── icon-144.png
    ├── icon-152.png
    ├── icon-192.png
    ├── icon-384.png
    └── icon-512.png
```

---

## ✏️ Passo 1 — Editar o index.html

Abra o `index.html` e:

**A) Cole no `<head>`** (após a linha do viewport):
```html
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#0f2040">
<meta name="apple-mobile-web-app-capable" content="apple-mobile-web-app-capable">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Portaria">
<link rel="apple-touch-icon" href="icons/icon-192.png">
```

**B) Cole antes do `</body>`**:
```html
<script>
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('[PWA] SW registrado'))
        .catch(err => console.warn('[PWA] Falha:', err));
    });
  }
</script>
```

---

## 🖼️ Passo 2 — Criar os ícones

Acesse: **https://realfavicongenerator.net** ou **https://maskable.app/editor**

- Faça upload de uma imagem quadrada (logo da portaria)
- Baixe os ícones nos tamanhos: 72, 96, 128, 144, 152, 192, 384, 512
- Salve na pasta `icons/`

---

## 🐙 Passo 3 — Subir no GitHub

```bash
git init
git add .
git commit -m "Portaria Savana PWA v1"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/portaria-savana.git
git push -u origin main
```

---

## 🌐 Passo 4 — Ativar GitHub Pages

1. No GitHub → **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: **main** / pasta: **/ (root)**
4. Salvar

Seu app ficará disponível em:
`https://SEU_USUARIO.github.io/portaria-savana/`

> ⚠️ **IMPORTANTE:** O Service Worker SÓ funciona em HTTPS.
> O GitHub Pages já fornece HTTPS automaticamente. ✅

---

## 📱 Passo 5 — Instalar no celular

### Android (Chrome):
1. Abra a URL no Chrome
2. Menu (3 pontinhos) → **"Adicionar à tela inicial"**
3. Confirme → ícone aparece como app nativo

### iOS (Safari):
1. Abra a URL no Safari
2. Botão compartilhar → **"Adicionar à Tela de Início"**
3. Confirme

---

## ✅ Checklist PWA

- [ ] index.html com tags `<link rel="manifest">` e registro do SW
- [ ] manifest.json na raiz
- [ ] sw.js na raiz  
- [ ] Pasta `icons/` com todos os tamanhos
- [ ] Hospedado em HTTPS (GitHub Pages)
- [ ] Testado no Chrome DevTools → Application → Manifest
