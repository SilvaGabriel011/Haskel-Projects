# Haskel Projects — landing page

Site estatico. Uma pagina, sem build, sem dependencia.

## Estrutura

```
haskel-site/
├── index.html      site inteiro (HTML + CSS + JS)
├── images/         suas fotos (ver images/LEIA-ME.txt)
└── README.md
```

## Deploy na Vercel

### Opcao A — arrastar (mais rapido, sem git)

1. Entre em https://vercel.com e crie a conta
2. Menu **Add New → Project → Deploy** e arraste a pasta `haskel-site`
3. Framework Preset: **Other**. Nao mexa em build command nem output directory
4. Deploy. Sai um endereco tipo `haskel-site.vercel.app`

### Opcao B — via GitHub (recomendado pra atualizar depois)

```bash
cd haskel-site
git init
git add .
git commit -m "landing page"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/haskel-site.git
git push -u origin main
```

Na Vercel: **Add New → Project → Import** o repositorio, Framework Preset **Other**, Deploy.
Depois disso todo `git push` publica sozinho.

### Dominio proprio

Settings → Domains → Add. A Vercel mostra os registros DNS pra apontar no seu registrador.

## Formulario

Hoje os formularios abrem o app de email ja preenchido, sem servidor. Se quiser que o lead
caia direto no email sem abrir o app, use Formspree (plano gratis):

1. Crie o form em https://formspree.io e pegue o endpoint
2. No `index.html`, troque o `mailto:` do bloco `<script>` por um `fetch` pro endpoint

## Editar textos

Tudo esta no `index.html`. Telefone e email aparecem em:
- nav (botao)
- secao Contact
- rodape
- variavel `EMAIL` no script no fim do arquivo
