# Haskel Projects — landing page

Site estatico. Uma pagina, sem build, sem dependencia.

## Estrutura

```
haskel-site/
├── index.html      pagina inicial
├── offcuts.html    pagina de offcuts (o que esta no rack essa semana)
├── styles.css      CSS compartilhado pelas duas paginas
├── images/         suas fotos (ver images/LEIA-ME.txt)
└── README.md
```

O CSS ficava dentro do `index.html`. Agora esta no `styles.css`, que as duas
paginas usam. Mexeu no visual? Mexe so no `styles.css` e vale pras duas.

## Estoque de offcuts

O `offcuts.html` esta com **seis cards de exemplo**. Antes de divulgar a pagina,
troque por pecas reais: material, medida, espessura, acabamento e situacao.

A situacao é a `<span class="oc-status ...">`:

- `in` — Available (rosa)
- `low` — Last one (laranja)
- `out` — Reserved (cinza)

Pode ter quantos cards quiser, a grade se ajusta sozinha.

## Deploy na Vercel

### Opcao A — arrastar (mais rapido, sem git)

1. Entre em https://vercel.com e crie a conta
2. Menu **Add New → Project → Deploy** e arraste a pasta `haskel-site`
3. Framework Preset: **Other**. Nao mexa em build command nem output directory
4. Deploy. Sai um endereco tipo `haskel-site.vercel.app`

### Opcao B — via GitHub (recomendado pra atualizar depois)

O repositorio `Haskel-Projects` ja tem o site dentro da pasta `haskel-site/`,
entao a raiz do repositorio NAO tem `index.html`. Sem dizer isso pra Vercel o
deploy quebra com:

```
Error: No Output Directory named "public" found after the Build completed.
```

Isso ja esta resolvido pelo `vercel.json` na raiz do repositorio:

```json
{
  "outputDirectory": "haskel-site"
}
```

Na Vercel: **Add New → Project → Import** o repositorio, Framework Preset
**Other**, e deixe build command e output directory vazios — o `vercel.json`
cuida do resto. Depois disso todo `git push` publica sozinho.

Alternativa (sem `vercel.json`): em **Settings → Build and Deployment →
Root Directory**, coloque `haskel-site`.

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
